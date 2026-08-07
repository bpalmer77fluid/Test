import { createHmac, timingSafeEqual } from 'crypto'

/**
 * WhatsApp Cloud API integration.
 *
 * Env vars required (see docs/whatsapp-commerce-spec.md):
 *   WHATSAPP_ACCESS_TOKEN     - System-user token for the WABA
 *   WHATSAPP_PHONE_NUMBER_ID  - Sender phone number ID
 *   WHATSAPP_VERIFY_TOKEN     - Arbitrary string echoed on webhook verification
 *   WHATSAPP_APP_SECRET       - Meta app secret, for X-Hub-Signature-256 checks
 *   WHATSAPP_CATALOG_ID       - Meta Commerce Manager catalog ID
 */
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

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
  type: 'text' | 'order' | 'interactive' | 'other'
  text?: string
  orderItems?: WhatsAppOrderItem[]
  catalogId?: string
  /** Referral payload when the chat was opened from a rep's wa.me deep link */
  referral?: { source_url?: string; body?: string }
}

export class WhatsAppService {
  static get phoneNumberId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  }

  static get verifyToken(): string {
    return process.env.WHATSAPP_VERIFY_TOKEN || ''
  }

  /**
   * Verify the X-Hub-Signature-256 header Meta sends with every webhook.
   * Must be computed over the RAW request body, not the parsed JSON.
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
        for (const msg of value?.messages || []) {
          const base = {
            from: msg.from,
            messageId: msg.id,
            timestamp: msg.timestamp,
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
  static async sendText(to: string, body: string): Promise<void> {
    await this.graphRequest(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  }

  /** Send the storefront entry point: a catalog message the customer can browse and cart from. */
  static async sendCatalogMessage(to: string, bodyText: string): Promise<void> {
    await this.graphRequest(`/${this.phoneNumberId}/messages`, {
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
    to: string,
    orderNumber: string,
    totalKes: number,
    statusLine: string
  ): Promise<void> {
    await this.sendText(
      to,
      `Order ${orderNumber} — KSh ${totalKes.toLocaleString('en-KE')}\n${statusLine}`
    )
  }

  /**
   * TODO(catalog-sync): push Fluid products into the Meta Commerce Manager
   * catalog (batch API: /{catalog_id}/items_batch) keyed by retailer_id = SKU.
   * Trigger from the existing product webhook in routes/webhook.ts.
   */
  static async syncProductToCatalog(_product: {
    sku: string
    title: string
    description?: string | null
    priceKes?: string | null
    imageUrl?: string | null
    inStock: boolean
  }): Promise<void> {
    throw new Error('Not implemented: Meta catalog sync (see whatsapp-commerce-spec.md §5.1)')
  }

  private static async graphRequest(path: string, payload: unknown): Promise<any> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured')

    const response = await fetch(`${GRAPH_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
