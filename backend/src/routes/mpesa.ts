import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { MpesaService } from '../services/mpesaService'
import { WhatsAppService, WhatsAppTenant } from '../services/whatsappService'
import { FluidService } from '../services/fluidService'

/**
 * M-Pesa Daraja callback endpoint. Safaricom POSTs the STK push result here;
 * we settle the payment record, flip the order (locally and in Fluid), and
 * close the loop in WhatsApp.
 */
export async function mpesaRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhook/mpesa/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Daraja callbacks carry no signature. A shared-secret path segment plus
      // (in production) Safaricom's published IP ranges is the practical guard.
      if (process.env.MPESA_CALLBACK_SECRET) {
        const provided = (request.query as Record<string, string>)?.secret
        if (provided !== process.env.MPESA_CALLBACK_SECRET) {
          fastify.log.warn('🚫 M-Pesa callback rejected: bad callback secret')
          return reply.status(401).send({ error: 'Unauthorized' })
        }
      }

      const result = MpesaService.parseCallback(request.body)
      if (!result) {
        fastify.log.warn('⚠️ Unrecognized M-Pesa callback payload')
        return reply.send({ ResultCode: 0, ResultDesc: 'Accepted' })
      }

      fastify.log.info(`💰 M-Pesa callback ${result.checkoutRequestId}: ${result.success ? 'PAID' : 'FAILED'} (${result.resultDescription})`)

      // Idempotency: only transition rows still pending, so Daraja retries no-op
      const payments = await prisma.$queryRaw`
        UPDATE mpesa_payments
        SET status = ${result.success ? 'success' : 'failed'},
            "receiptNumber" = ${result.receiptNumber || null},
            "resultDescription" = ${result.resultDescription},
            "rawCallback" = ${JSON.stringify(request.body)}::jsonb,
            "updatedAt" = NOW()
        WHERE "checkoutRequestId" = ${result.checkoutRequestId} AND status = 'pending'
        RETURNING "installationId", "orderReference", "fluidOrderId", phone, amount
      ` as any[]

      if (!payments.length) {
        fastify.log.warn(`⚠️ No pending mpesa_payments row for checkoutRequestId ${result.checkoutRequestId} (missing or already settled)`)
        return reply.send({ ResultCode: 0, ResultDesc: 'Accepted' })
      }

      const payment = payments[0]
      const tenant = await resolveTenantForInstallation(payment.installationId)

      if (result.success) {
        await prisma.$executeRaw`
          UPDATE orders
          SET status = 'paid', "updatedAt" = NOW()
          WHERE "installationId" = ${payment.installationId} AND "fluidOrderId" = ${payment.orderReference}
        `

        // Mark the order paid in Fluid so fulfillment and rep commissions fire upstream
        if (payment.fluidOrderId) {
          const ctx = await FluidService.getInstallationContext(payment.installationId)
          if (ctx) {
            const marked = await FluidService.markOrderPaid(
              ctx,
              payment.fluidOrderId,
              { amountKes: Number(payment.amount), receiptNumber: result.receiptNumber },
              fastify.log
            )
            if (!marked) fastify.log.warn(`⚠️ Could not mark Fluid order ${payment.fluidOrderId} paid; local state is settled`)
          }
        }

        if (tenant) {
          await WhatsAppService.sendOrderConfirmation(
            tenant,
            payment.phone,
            payment.orderReference,
            Number(payment.amount),
            `Payment received ✅ (M-Pesa ref ${result.receiptNumber}). We are preparing your order.`
          ).catch(err => fastify.log.error(`❌ Failed to send WhatsApp receipt: ${err}`))
        }
      } else if (tenant) {
        await WhatsAppService.sendText(
          tenant,
          payment.phone,
          `Payment for order ${payment.orderReference} was not completed (${result.resultDescription}). Reply "pay" to try again.`
        ).catch(err => fastify.log.error(`❌ Failed to send WhatsApp payment-failure notice: ${err}`))
      }

      // Daraja expects this exact acknowledgment shape
      return reply.send({ ResultCode: 0, ResultDesc: 'Accepted' })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'M-Pesa callback processing failed' })
    }
  })
}

/** Tenant lookup for outbound messages: per-installation config, env fallback. */
async function resolveTenantForInstallation(installationId: string): Promise<WhatsAppTenant | null> {
  const configs = await prisma.$queryRaw`
    SELECT "phoneNumberId", "accessToken", "catalogId"
    FROM whatsapp_configs
    WHERE "installationId" = ${installationId}
    LIMIT 1
  ` as any[]

  if (configs.length) {
    return {
      phoneNumberId: configs[0].phoneNumberId,
      accessToken: configs[0].accessToken,
      catalogId: configs[0].catalogId
    }
  }

  const envTenant = WhatsAppService.envTenant()
  return envTenant.accessToken && envTenant.phoneNumberId ? envTenant : null
}
