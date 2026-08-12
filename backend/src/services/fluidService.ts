import { prisma } from '../db'
import { WhatsAppOrderItem } from './whatsappService'

/**
 * Fluid platform order integration. Creates WhatsApp-originated orders in
 * Fluid via the installation's DIT token so fulfillment, reporting, and rep
 * commissions fire upstream, and marks them paid on M-Pesa settlement.
 *
 * Endpoint strategy mirrors OrderService.fetchOrdersFromFluid: try the v1
 * subdomain API first, then fall back. A Fluid failure never blocks the
 * WhatsApp flow — the local orders row is the source of truth until sync.
 */
export interface FluidInstallationContext {
  installationId: string
  fluidShop: string | null // e.g. "myco.fluid.app"
  authToken: string | null
}

export class FluidService {
  /** Load what we need to call the Fluid API on behalf of an installation. */
  static async getInstallationContext(installationId: string): Promise<FluidInstallationContext | null> {
    const rows = await prisma.$queryRaw`
      SELECT i.id as "installationId", i."authenticationToken", i."webhookVerificationToken", c."fluidShop"
      FROM installations i
      JOIN companies c ON i."companyId" = c.id
      WHERE i.id = ${installationId} AND i."isActive" = true
      LIMIT 1
    ` as any[]
    if (!rows.length) return null

    return {
      installationId: rows[0].installationId,
      fluidShop: rows[0].fluidShop,
      authToken: rows[0].authenticationToken || rows[0].webhookVerificationToken || null
    }
  }

  /**
   * Create an order in Fluid from a WhatsApp cart. Returns the Fluid order ID,
   * or null when the API rejects it (caller keeps the local order regardless).
   */
  static async createOrder(
    ctx: FluidInstallationContext,
    order: {
      reference: string
      customerPhone: string
      items: WhatsAppOrderItem[]
      totalKes: number
      repShareGuid?: string | null
    },
    log?: { info: (msg: string) => void; warn: (msg: string) => void }
  ): Promise<string | null> {
    const payload = {
      order: {
        external_id: order.reference,
        source: 'whatsapp',
        customer_phone: order.customerPhone,
        rep_share_guid: order.repShareGuid || undefined,
        currency: 'KES',
        total: order.totalKes,
        line_items: order.items.map(item => ({
          sku: item.product_retailer_id,
          quantity: item.quantity,
          price: item.item_price
        }))
      }
    }

    const result = await this.request(ctx, 'POST', 'orders', payload, log)
    const fluidOrderId = result?.order?.id ?? result?.id ?? null
    return fluidOrderId != null ? String(fluidOrderId) : null
  }

  /** Mark a Fluid order paid after the M-Pesa callback settles. */
  static async markOrderPaid(
    ctx: FluidInstallationContext,
    fluidOrderId: string,
    payment: { amountKes: number; receiptNumber?: string },
    log?: { info: (msg: string) => void; warn: (msg: string) => void }
  ): Promise<boolean> {
    const payload = {
      order: {
        status: 'paid',
        payment: {
          method: 'mpesa',
          amount: payment.amountKes,
          currency: 'KES',
          reference: payment.receiptNumber || undefined
        }
      }
    }

    const result = await this.request(ctx, 'PATCH', `orders/${fluidOrderId}`, payload, log)
    return result !== null
  }

  private static async request(
    ctx: FluidInstallationContext,
    method: 'POST' | 'PATCH',
    resource: string,
    payload: unknown,
    log?: { info: (msg: string) => void; warn: (msg: string) => void }
  ): Promise<any | null> {
    if (!ctx.fluidShop || !ctx.authToken) {
      log?.warn(`⚠️ Fluid API skipped for ${resource}: missing fluidShop or auth token`)
      return null
    }

    const subdomain = ctx.fluidShop.replace('.fluid.app', '')
    const endpoints = [
      `https://${subdomain}.fluid.app/api/v1/${resource}`,
      `https://fluid.app/api/v1/${resource}?company=${subdomain}`
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            Authorization: `Bearer ${ctx.authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (response.ok) {
          log?.info(`✅ Fluid ${method} ${resource} succeeded via ${endpoint}`)
          return response.json()
        }

        // 404 likely means wrong endpoint shape — try the next; other codes are real failures
        const errorText = await response.text()
        log?.warn(`⚠️ Fluid ${method} ${endpoint} -> ${response.status}: ${errorText.slice(0, 300)}`)
        if (response.status !== 404) return null
      } catch (err) {
        log?.warn(`⚠️ Fluid ${method} ${endpoint} network error: ${err}`)
      }
    }

    return null
  }
}
