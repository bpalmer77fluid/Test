import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { WhatsAppService, WhatsAppTenant, InboundWhatsAppMessage } from '../services/whatsappService'
import { MpesaService } from '../services/mpesaService'
import { FluidService } from '../services/fluidService'

/**
 * WhatsApp Cloud API webhook endpoints.
 *
 * Flow (see docs/whatsapp-commerce-spec.md):
 *   1. Customer opens chat from a rep's wa.me deep link (referral carries rep shareGuid)
 *   2. Bot sends the native catalog message; customer browses + builds a cart in WhatsApp
 *   3. Cart arrives here as an `order` message -> order created locally AND in Fluid
 *   4. We fire an M-Pesa STK push; the PIN prompt pops on the customer's phone
 *   5. Daraja callback (routes/mpesa.ts) confirms payment -> order paid -> receipt sent
 */
interface ResolvedTenant {
  installationId: string
  tenant: WhatsAppTenant
}

export async function whatsappRoutes(fastify: FastifyInstance) {
  // Meta webhook verification handshake (performed once when configuring the app)
  fastify.get('/api/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (mode === 'subscribe' && token === WhatsAppService.verifyToken) {
      return reply.send(challenge)
    }
    return reply.status(403).send({ error: 'Verification failed' })
  })

  // Inbound messages + statuses
  fastify.post('/api/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verify X-Hub-Signature-256 over the raw body (preserved in config/fastify.ts).
      // Enforced whenever an app secret is configured; without one we log and continue
      // so local development against ngrok/sandbox keeps working.
      const rawBody = (request as any).rawBody as Buffer | undefined
      const signature = request.headers['x-hub-signature-256'] as string | undefined
      if (process.env.WHATSAPP_APP_SECRET) {
        if (!rawBody || !WhatsAppService.verifySignature(rawBody, signature)) {
          fastify.log.warn('🚫 WhatsApp webhook rejected: bad or missing X-Hub-Signature-256')
          return reply.status(401).send({ error: 'Invalid signature' })
        }
      } else {
        fastify.log.warn('⚠️ WHATSAPP_APP_SECRET not set — webhook signature NOT verified')
      }

      const body = request.body as any
      const messages = WhatsAppService.parseInbound(body)

      // Ack immediately; Meta retries on non-200 and we never want double-processing
      reply.send({ status: 'ok' })

      for (const message of messages) {
        setImmediate(() => handleInbound(fastify, message).catch(err =>
          fastify.log.error(`❌ WhatsApp message handling failed: ${err}`)
        ))
      }
      return
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'WhatsApp webhook processing failed' })
    }
  })
}

/**
 * Multi-tenant routing: the receiving number's phone_number_id maps to an
 * installation via whatsapp_configs. Env-var config is the single-tenant
 * fallback (first active installation) so the sandbox works with zero rows.
 */
async function resolveTenant(fastify: FastifyInstance, phoneNumberId?: string): Promise<ResolvedTenant | null> {
  if (phoneNumberId) {
    const configs = await prisma.$queryRaw`
      SELECT wc."installationId", wc."phoneNumberId", wc."accessToken", wc."catalogId"
      FROM whatsapp_configs wc
      JOIN installations i ON wc."installationId" = i.id
      WHERE wc."phoneNumberId" = ${phoneNumberId} AND i."isActive" = true
      LIMIT 1
    ` as any[]

    if (configs.length) {
      const config = configs[0]
      return {
        installationId: config.installationId,
        tenant: {
          phoneNumberId: config.phoneNumberId,
          accessToken: config.accessToken,
          catalogId: config.catalogId
        }
      }
    }
  }

  const envTenant = WhatsAppService.envTenant()
  if (!envTenant.accessToken) {
    fastify.log.warn(`⚠️ No whatsapp_config for phone_number_id ${phoneNumberId} and no env fallback`)
    return null
  }

  const installations = await prisma.$queryRaw`
    SELECT i.id as "installationId"
    FROM installations i
    WHERE i."isActive" = true
    ORDER BY i."createdAt" ASC
    LIMIT 1
  ` as any[]
  if (!installations.length) {
    fastify.log.warn('⚠️ No active installation for inbound WhatsApp message')
    return null
  }

  return {
    installationId: installations[0].installationId,
    tenant: { ...envTenant, phoneNumberId: phoneNumberId || envTenant.phoneNumberId }
  }
}

async function handleInbound(fastify: FastifyInstance, message: InboundWhatsAppMessage) {
  const resolved = await resolveTenant(fastify, message.phoneNumberId)
  if (!resolved) return
  const { installationId, tenant } = resolved

  // Rep attribution: wa.me deep links carry ?text=ref:<shareGuid>; referral.body preserves it
  const refMatch = (message.referral?.body || message.text || '').match(/ref:([\w-]+)/)
  let repId: string | null = null
  let repShareGuid: string | null = null
  if (refMatch) {
    const reps = await prisma.$queryRaw`
      SELECT id, "shareGuid" FROM reps
      WHERE "installationId" = ${installationId} AND "shareGuid" = ${refMatch[1]}
      LIMIT 1
    ` as any[]
    repId = reps[0]?.id || null
    repShareGuid = reps[0]?.shareGuid || null
  }

  // Upsert the chat session (state machine + rep binding, first-touch wins)
  const sessions = await prisma.$queryRaw`
    INSERT INTO whatsapp_sessions (id, "installationId", phone, "repId", state, "lastMessageAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${installationId}, ${message.from}, ${repId}, 'active', NOW(), NOW(), NOW())
    ON CONFLICT ("installationId", phone)
    DO UPDATE SET
      "repId" = COALESCE(whatsapp_sessions."repId", EXCLUDED."repId"),
      "lastMessageAt" = NOW(),
      "updatedAt" = NOW()
    RETURNING "repId"
  ` as any[]

  // Use the session's bound rep (covers carts sent after the initial referral message)
  const sessionRepId = sessions[0]?.repId || repId
  if (sessionRepId && !repShareGuid) {
    const reps = await prisma.$queryRaw`
      SELECT "shareGuid" FROM reps WHERE id = ${sessionRepId} LIMIT 1
    ` as any[]
    repShareGuid = reps[0]?.shareGuid || null
  }

  if (message.type === 'order' && message.orderItems?.length) {
    await handleCartSubmission(fastify, installationId, tenant, message, repShareGuid)
  } else if (message.type === 'text') {
    // Any text starts (or restarts) the shopping flow with the native catalog
    await WhatsAppService.sendCatalogMessage(
      tenant,
      message.from,
      'Karibu! Browse our catalog below and add items to your cart. When you send the cart we will send an M-Pesa prompt to this number.'
    )
  }
}

async function handleCartSubmission(
  fastify: FastifyInstance,
  installationId: string,
  tenant: WhatsAppTenant,
  message: InboundWhatsAppMessage,
  repShareGuid: string | null
) {
  const items = message.orderItems!
  const totalKes = Math.round(items.reduce((sum, item) => sum + item.item_price * item.quantity, 0))
  const orderReference = `WA-${Date.now().toString(36).toUpperCase()}`

  fastify.log.info(`🛒 WhatsApp cart from ${message.from}: ${items.length} item(s), KSh ${totalKes}`)

  // Local order record first — source of truth even if the Fluid API call fails
  await prisma.$executeRaw`
    INSERT INTO orders (
      id, "installationId", "fluidOrderId", "orderNumber", amount, status,
      "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${installationId}, ${orderReference}, ${orderReference},
      ${String(totalKes)}, 'pending_payment', null, ${message.from},
      ${items.length}::integer,
      ${JSON.stringify({ source: 'whatsapp', items, from: message.from, repShareGuid })}::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT ("installationId", "fluidOrderId") DO NOTHING
  `

  // Create the order in Fluid so fulfillment + rep commissions fire upstream
  let fluidOrderId: string | null = null
  const ctx = await FluidService.getInstallationContext(installationId)
  if (ctx) {
    fluidOrderId = await FluidService.createOrder(
      ctx,
      { reference: orderReference, customerPhone: message.from, items, totalKes, repShareGuid },
      fastify.log
    )
    if (!fluidOrderId) {
      fastify.log.warn(`⚠️ Fluid order creation failed for ${orderReference}; local order retained`)
    }
  }

  const stk = await MpesaService.stkPush({
    phone: message.from,
    amount: totalKes,
    accountReference: orderReference,
    description: 'WhatsApp order'
  })

  await prisma.$executeRaw`
    INSERT INTO mpesa_payments (
      id, "installationId", "orderReference", "fluidOrderId", "checkoutRequestId",
      "merchantRequestId", phone, amount, status, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${installationId}, ${orderReference}, ${fluidOrderId},
      ${stk.checkoutRequestId}, ${stk.merchantRequestId}, ${message.from},
      ${String(totalKes)}, 'pending', NOW(), NOW()
    )
  `

  await WhatsAppService.sendOrderConfirmation(
    tenant,
    message.from,
    orderReference,
    totalKes,
    'Check your phone for the M-Pesa prompt and enter your PIN to pay. 🙏'
  )
}
