import { prisma } from '../db'
import { WhatsAppService, WhatsAppTenant } from './whatsappService'
import { TemplateService, TemplatePurpose } from './templateService'
import { MpesaService } from './mpesaService'

/**
 * Abandoned-cart recovery.
 *
 * Industry data puts WhatsApp cart recovery at 18–23% on optimized flows, and
 * automated flows at 60–70% of all WhatsApp revenue — so this is the highest
 * ROI feature after checkout itself
 * (docs/whatsapp-commerce-competitive-playbook.md §3).
 *
 * What "abandoned" means here: the cart became a real order and an M-Pesa STK
 * push was fired, but the customer never entered their PIN (or it failed), so
 * the order is still `pending_payment`. That is the abandonment we can observe
 * — catalog browsing without a submitted cart is invisible to the Cloud API.
 *
 * Cadence — first touch fast, then decreasing pressure:
 *   Stage 1  +30 minutes  reminder      (usually inside the 24h window)
 *   Stage 2  +24 hours    reassurance   (outside window -> template required)
 *   Stage 3  +72 hours    final call    (outside window -> template required)
 *
 * Window rule: free-form text is only legal within 24 hours of the customer's
 * last inbound message. Outside that, an APPROVED template is mandatory; if
 * none exists we skip rather than attempt an illegal send.
 */
const STAGE_DELAYS_MINUTES = [
  Number(process.env.CART_RECOVERY_STAGE_1_MINUTES || 30),
  Number(process.env.CART_RECOVERY_STAGE_2_MINUTES || 24 * 60),
  Number(process.env.CART_RECOVERY_STAGE_3_MINUTES || 72 * 60)
]

const STAGE_PURPOSES: TemplatePurpose[] = [
  'cart_recovery_1',
  'cart_recovery_2',
  'cart_recovery_3'
]

const MAX_STAGES = STAGE_DELAYS_MINUTES.length

export interface RecoveryRunResult {
  considered: number
  sent: number
  skipped: number
  failed: number
  exhausted: number
}

export class CartRecoveryService {
  /** Called when an STK push is fired, so an unpaid order becomes recoverable. */
  static async schedule(params: {
    installationId: string
    orderReference: string
    phone: string
    amount: number
    itemsSummary?: string
  }): Promise<void> {
    const nextAttemptAt = new Date(Date.now() + STAGE_DELAYS_MINUTES[0] * 60_000)

    await prisma.$executeRaw`
      INSERT INTO cart_recoveries (
        id, "installationId", "orderReference", phone, amount, "itemsSummary",
        stage, status, "abandonedAt", "nextAttemptAt", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${params.installationId}, ${params.orderReference},
        ${params.phone}, ${String(params.amount)}, ${params.itemsSummary || null},
        0, 'pending', NOW(), ${nextAttemptAt}, NOW(), NOW()
      )
      ON CONFLICT ("installationId", "orderReference") DO NOTHING
    `
  }

  /** Payment settled — stop chasing. */
  static async markRecovered(installationId: string, orderReference: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE cart_recoveries
      SET status = 'recovered', "recoveredAt" = NOW(), "nextAttemptAt" = null, "updatedAt" = NOW()
      WHERE "installationId" = ${installationId}
        AND "orderReference" = ${orderReference}
        AND status = 'pending'
    `
  }

  /** Customer asked to stop, or cancelled the order. */
  static async cancel(installationId: string, orderReference: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE cart_recoveries
      SET status = 'cancelled', "nextAttemptAt" = null, "updatedAt" = NOW()
      WHERE "installationId" = ${installationId}
        AND "orderReference" = ${orderReference}
        AND status = 'pending'
    `
  }

  /** Stop chasing every open cart for a phone number (used by STOP / cancel). */
  static async cancelAllForPhone(installationId: string, phone: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE cart_recoveries
      SET status = 'cancelled', "nextAttemptAt" = null, "updatedAt" = NOW()
      WHERE "installationId" = ${installationId} AND phone = ${phone} AND status = 'pending'
    `
  }

  /** Most recent unpaid order for a phone — powers the "reply pay" retry. */
  static async findOpenCart(installationId: string, phone: string): Promise<{
    orderReference: string
    amount: string
  } | null> {
    const rows = await prisma.$queryRaw`
      SELECT "orderReference", amount
      FROM cart_recoveries
      WHERE "installationId" = ${installationId} AND phone = ${phone} AND status = 'pending'
      ORDER BY "abandonedAt" DESC
      LIMIT 1
    ` as any[]
    return rows[0] || null
  }

  /**
   * Re-fire an STK push for an open cart ("reply pay"). Records a new payment
   * attempt row so the Daraja callback can settle it.
   */
  static async retryPayment(
    installationId: string,
    phone: string,
    log?: { info: (m: string) => void; warn: (m: string) => void }
  ): Promise<{ retried: boolean; orderReference?: string; amount?: number }> {
    const open = await this.findOpenCart(installationId, phone)
    if (!open) return { retried: false }

    const amount = Math.round(Number(open.amount))
    const stk = await MpesaService.stkPush({
      phone,
      amount,
      accountReference: open.orderReference,
      description: 'WhatsApp order retry'
    })

    // Reuse the fluidOrderId already linked to this order reference, if any
    const existing = await prisma.$queryRaw`
      SELECT "fluidOrderId" FROM mpesa_payments
      WHERE "installationId" = ${installationId} AND "orderReference" = ${open.orderReference}
      ORDER BY "createdAt" DESC LIMIT 1
    ` as any[]

    await prisma.$executeRaw`
      INSERT INTO mpesa_payments (
        id, "installationId", "orderReference", "fluidOrderId", "checkoutRequestId",
        "merchantRequestId", phone, amount, status, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${installationId}, ${open.orderReference},
        ${existing[0]?.fluidOrderId || null}, ${stk.checkoutRequestId},
        ${stk.merchantRequestId}, ${phone}, ${String(amount)}, 'pending', NOW(), NOW()
      )
    `

    log?.info(`🔁 Retried STK push for ${open.orderReference} (${phone})`)
    return { retried: true, orderReference: open.orderReference, amount }
  }

  /**
   * Process every recovery whose next attempt is due. Safe to call repeatedly
   * (cron or interval) — each row advances at most one stage per run.
   */
  static async runDue(
    resolveTenant: (installationId: string) => Promise<WhatsAppTenant | null>,
    log?: { info: (m: string) => void; warn: (m: string) => void },
    limit = 100
  ): Promise<RecoveryRunResult> {
    const result: RecoveryRunResult = { considered: 0, sent: 0, skipped: 0, failed: 0, exhausted: 0 }

    // Claim due rows. Reconcile first: anything already paid should not be chased.
    await prisma.$executeRaw`
      UPDATE cart_recoveries cr
      SET status = 'recovered', "recoveredAt" = NOW(), "nextAttemptAt" = null, "updatedAt" = NOW()
      WHERE cr.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o."installationId" = cr."installationId"
            AND o."fluidOrderId" = cr."orderReference"
            AND o.status = 'paid'
        )
    `

    const due = await prisma.$queryRaw`
      SELECT cr.id, cr."installationId", cr."orderReference", cr.phone, cr.amount,
             cr.stage, cr."itemsSummary",
             ws."lastMessageAt" as "lastInboundAt"
      FROM cart_recoveries cr
      LEFT JOIN whatsapp_sessions ws
        ON ws."installationId" = cr."installationId" AND ws.phone = cr.phone
      WHERE cr.status = 'pending'
        AND cr."nextAttemptAt" IS NOT NULL
        AND cr."nextAttemptAt" <= NOW()
      ORDER BY cr."nextAttemptAt" ASC
      LIMIT ${limit}
    ` as any[]

    result.considered = due.length

    for (const row of due) {
      const stage = row.stage as number

      if (stage >= MAX_STAGES) {
        await prisma.$executeRaw`
          UPDATE cart_recoveries
          SET status = 'exhausted', "nextAttemptAt" = null, "updatedAt" = NOW()
          WHERE id = ${row.id}
        `
        result.exhausted++
        continue
      }

      const tenant = await resolveTenant(row.installationId)
      if (!tenant) {
        log?.warn(`⚠️ Cart recovery skipped ${row.orderReference}: no WhatsApp config`)
        await this.deferOrExhaust(row.id, stage)
        result.skipped++
        continue
      }

      const amountLabel = Number(row.amount).toLocaleString('en-KE')
      const firstName = 'there' // Cloud API does not expose a verified name; keep it neutral

      // Free-form text is only legal within 24h of the customer's last message
      const lastInbound = row.lastInboundAt ? new Date(row.lastInboundAt).getTime() : 0
      const withinWindow = lastInbound > 0 && Date.now() - lastInbound < 24 * 60 * 60 * 1000

      try {
        if (withinWindow) {
          await WhatsAppService.sendText(
            tenant,
            row.phone,
            stage === 0
              ? `Your order ${row.orderReference} for KSh ${amountLabel} is still waiting for payment. Reply *pay* and we will send the M-Pesa prompt again.`
              : `Order ${row.orderReference} (KSh ${amountLabel}) is still open. Reply *pay* to complete it, or *cancel* to close it.`
          )
        } else {
          const purpose = STAGE_PURPOSES[stage]
          const template = await TemplateService.getApproved(row.installationId, purpose, 'en')

          if (!template) {
            // No approved template: sending free-form here would violate policy
            log?.warn(`⚠️ Cart recovery skipped ${row.orderReference}: no approved template for ${purpose}`)
            await this.deferOrExhaust(row.id, stage)
            result.skipped++
            continue
          }

          const params =
            template.placeholderCount === 3
              ? [firstName, row.orderReference, amountLabel]
              : [firstName, row.orderReference]

          await WhatsAppService.sendTemplate(
            tenant,
            row.phone,
            template.name,
            template.language,
            params.slice(0, template.placeholderCount)
          )
        }

        const nextStage = stage + 1
        const nextAttemptAt =
          nextStage < MAX_STAGES
            ? new Date(Date.now() + (STAGE_DELAYS_MINUTES[nextStage] - STAGE_DELAYS_MINUTES[stage]) * 60_000)
            : null

        await prisma.$executeRaw`
          UPDATE cart_recoveries
          SET stage = ${nextStage}::integer,
              "lastAttemptAt" = NOW(),
              "nextAttemptAt" = ${nextAttemptAt},
              status = ${nextAttemptAt ? 'pending' : 'exhausted'},
              "lastError" = null,
              "updatedAt" = NOW()
          WHERE id = ${row.id}
        `

        result.sent++
        if (!nextAttemptAt) result.exhausted++
        log?.info(`📨 Cart recovery stage ${nextStage} sent for ${row.orderReference}`)
      } catch (err) {
        await prisma.$executeRaw`
          UPDATE cart_recoveries
          SET "lastError" = ${String(err).slice(0, 500)},
              "nextAttemptAt" = NOW() + INTERVAL '1 hour',
              "updatedAt" = NOW()
          WHERE id = ${row.id}
        `
        log?.warn(`⚠️ Cart recovery failed for ${row.orderReference}: ${err}`)
        result.failed++
      }
    }

    return result
  }

  /** Push a skipped attempt out an hour, or give up if it was the last stage. */
  private static async deferOrExhaust(id: string, stage: number): Promise<void> {
    if (stage + 1 >= MAX_STAGES) {
      await prisma.$executeRaw`
        UPDATE cart_recoveries
        SET status = 'exhausted', "nextAttemptAt" = null, "updatedAt" = NOW()
        WHERE id = ${id}
      `
      return
    }
    await prisma.$executeRaw`
      UPDATE cart_recoveries
      SET "nextAttemptAt" = NOW() + INTERVAL '1 hour', "updatedAt" = NOW()
      WHERE id = ${id}
    `
  }
}
