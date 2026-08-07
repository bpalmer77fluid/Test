import { createHmac, timingSafeEqual } from 'crypto'

/**
 * WhatsApp Cloud API integration.
 *
 * Global env vars (single-tenant fallback; see docs/whatsapp-commerce-spec.md):
 *   WHATSAPP_ACCESS_TOKEN     - System-user token for the WABA
 *   WHATSAPP_PHONE_NUMBER_ID  - Sender phone number ID
 *   WHATSAPP_VERIFY_TOKEN     - Arbitrary string echoed on webhook verification
 *   WHATSAPP_APP_SECRET       - Meta app secret, for X-Hub-Signature-256 checks
 *   WHATSAPP_CATALOG_ID       - Meta Commerce Manager catalog ID
 *
 * Multi-tenant: a whatsapp_configs row per installation overrides these
 * (routes/whatsapp.ts resolves the tenant from the webhook's phone_number_id).
 */
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export interface WhatsAppTenant {
  phoneNumberId: string
  accessToken: string
  catalogId?: string | null
}

export interface WhatsAppOrderItem {
  product_retailer_id: string // maps to Fluid product SKU / fluidProductId
  quantity: number
  item_price: number
  currency: string // "KES"
}

export interface InboundWhatsAppMessage {
  from: string // customer phone in E.164 without "+", e.g. "254712345678"
  messageId: string
  timestamp: string
  /** Receiving business number's phone_number_id — the multi-tenant routing key */
  phoneNumberId?: string
  type: 'text' | 'order' | 'interactive' | 'other'
  text?: string
  orderItems?: WhatsAppOrderItem[]
  catalogId?: string
  /** Referral payload when the chat was opened from a rep's wa.me deep link */
  referral?: { source_url?: string; body?: string }
}

export class WhatsAppService {
  static envTenant(): WhatsAppTenant {
    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      catalogId: process.env.WHATSAPP_CATALOG_ID || null
    }
  }

  static get verifyToken(): string {
    return process.env.WHATSAPP_VERIFY_TOKEN || ''
  }

  /**
   * Verify the X-Hub-Signature-256 header Meta sends with every webhook.
   * Computed over the RAW request body (config/fastify.ts preserves it).
   */
  static verifySignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret || !signatureHeader) return false

    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(signatureHeader)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  /**
   * Flatten the Cloud API webhook envelope (entry[].changes[].value.messages[])
   * into a list of typed inbound messages.
   */
  static parseInbound(body: any): InboundWhatsAppMessage[] {
    const messages: InboundWhatsAppMessage[] = []

    for (const entry of body?.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value
        const phoneNumberId = value?.metadata?.phone_number_id
        for (const msg of value?.messages || []) {
          const base = {
            from: msg.from,
            messageId: msg.id,
            timestamp: msg.timestamp,
            phoneNumberId,
            referral: msg.referral
          }

          if (msg.type === 'text') {
            messages.push({ ...base, type: 'text', text: msg.text?.body })
          } else if (msg.type === 'order') {
            // Customer submitted a cart built from the native WhatsApp catalog
            messages.push({
              ...base,
              type: 'order',
              catalogId: msg.order?.catalog_id,
              orderItems: msg.order?.product_items || []
            })
          } else if (msg.type === 'interactive') {
            messages.push({ ...base, type: 'interactive', text: msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id })
          } else {
            messages.push({ ...base, type: 'other' })
          }
        }
      }
    }

    return messages
  }

  /** Send a plain text message inside an open 24h customer-service window. */
  static async sendText(tenant: WhatsAppTenant, to: string, body: string): Promise<void> {
    await this.graphRequest(tenant.accessToken, `/${tenant.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  }

  /** Send the storefront entry point: a catalog message the customer can browse and cart from. */
  static async sendCatalogMessage(tenant: WhatsAppTenant, to: string, bodyText: string): Promise<void> {
    await this.graphRequest(tenant.accessToken, `/${tenant.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: bodyText },
        action: { name: 'catalog_message' }
      }
    })
  }

  /** Confirmation with order summary after the cart lands and before/after payment. */
  static async sendOrderConfirmation(
    tenant: WhatsAppTenant,
    to: string,
    orderNumber: string,
    totalKes: number,
    statusLine: string
  ): Promise<void> {
    await this.sendText(
      tenant,
      to,
      `Order ${orderNumber} — KSh ${totalKes.toLocaleString('en-KE')}\n${statusLine}`
    )
  }

  /**
   * Upsert one Fluid product into the tenant's Meta Commerce Manager catalog.
   * Uses the items_batch API keyed by retailer_id (= Fluid SKU / product ID),
   * so repeated calls update in place. Prices are minor units + currency.
   */
  static async syncProductToCatalog(
    tenant: WhatsAppTenant,
    product: {
      retailerId: string
      title: string
      description?: string | null
      priceKes?: string | null
      imageUrl?: string | null
      inStock: boolean
      productUrl?: string | null
    }
  ): Promise<void> {
    if (!tenant.catalogId) throw new Error('No catalog ID configured for this tenant')

    const priceMinorUnits = product.priceKes
      ? Math.round(parseFloat(product.priceKes) * 100)
      : 0

    await this.graphRequest(tenant.accessToken, `/${tenant.catalogId}/items_batch`, {
      item_type: 'PRODUCT_ITEM',
      requests: [
        {
          method: 'UPDATE', // UPDATE upserts: creates when the retailer_id is new
          data: {
            id: product.retailerId,
            title: product.title.slice(0, 200),
            description: (product.description || product.title).slice(0, 9999),
            availability: product.inStock ? 'in stock' : 'out of stock',
            condition: 'new',
            price: `${priceMinorUnits} KES`,
            link: product.productUrl || 'https://fluid.app',
            image_link: product.imageUrl || 'https://fluid.app/favicon.png'
          }
        }
      ]
    })
  }

  private static async graphRequest(accessToken: string, path: string, payload: unknown): Promise<any> {
    if (!accessToken) throw new Error('WhatsApp access token is not configured')

    const response = await fetch(`${GRAPH_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`WhatsApp Graph API ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}
