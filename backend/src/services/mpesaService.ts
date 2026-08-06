/**
 * M-Pesa Daraja API integration (STK Push / Lipa na M-Pesa Online).
 *
 * Env vars required (see docs/whatsapp-commerce-spec.md):
 *   MPESA_ENV            - "sandbox" | "production"
 *   MPESA_CONSUMER_KEY   - Daraja app consumer key
 *   MPESA_CONSUMER_SECRET- Daraja app consumer secret
 *   MPESA_SHORTCODE      - Paybill or till number
 *   MPESA_PASSKEY        - Lipa na M-Pesa Online passkey
 *   MPESA_CALLBACK_URL   - Public URL of /api/webhook/mpesa/callback
 */
const BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke'
}

export interface StkPushRequest {
  phone: string // customer phone, E.164 without "+", e.g. "254712345678"
  amount: number // whole KES
  accountReference: string // shows on the customer's statement, e.g. order number
  description: string
}

export interface StkPushResponse {
  merchantRequestId: string
  checkoutRequestId: string
  responseCode: string
  customerMessage: string
}

export interface MpesaCallbackResult {
  checkoutRequestId: string
  merchantRequestId: string
  success: boolean
  resultCode: number
  resultDescription: string
  amount?: number
  receiptNumber?: string
  phone?: string
}

export class MpesaService {
  private static get baseUrl(): string {
    return BASE_URLS[(process.env.MPESA_ENV as 'sandbox' | 'production') || 'sandbox']
  }

  /** OAuth client-credentials token, valid ~1h. TODO: cache until expiry. */
  static async getAccessToken(): Promise<string> {
    const key = process.env.MPESA_CONSUMER_KEY
    const secret = process.env.MPESA_CONSUMER_SECRET
    if (!key || !secret) throw new Error('MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET not configured')

    const credentials = Buffer.from(`${key}:${secret}`).toString('base64')
    const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` }
    })

    if (!response.ok) throw new Error(`Daraja OAuth failed: ${response.status}`)
    const data = (await response.json()) as { access_token: string }
    return data.access_token
  }

  /**
   * Fire an STK push: the customer gets the M-Pesa PIN prompt on their phone,
   * layered over whatever app they're in (i.e. WhatsApp). Result arrives async
   * on MPESA_CALLBACK_URL.
   */
  static async stkPush(request: StkPushRequest): Promise<StkPushResponse> {
    const shortcode = process.env.MPESA_SHORTCODE
    const passkey = process.env.MPESA_PASSKEY
    const callbackUrl = process.env.MPESA_CALLBACK_URL
    if (!shortcode || !passkey || !callbackUrl) {
      throw new Error('MPESA_SHORTCODE / MPESA_PASSKEY / MPESA_CALLBACK_URL not configured')
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14) // YYYYMMDDHHmmss
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

    const token = await this.getAccessToken()
    const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // use 'CustomerBuyGoodsOnline' for till numbers
        Amount: request.amount,
        PartyA: request.phone,
        PartyB: shortcode,
        PhoneNumber: request.phone,
        CallBackURL: callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.description
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`STK push failed ${response.status}: ${errorText}`)
    }

    const data = (await response.json()) as any
    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      customerMessage: data.CustomerMessage
    }
  }

  /** Normalize the Daraja stkCallback payload. ResultCode 0 = paid. */
  static parseCallback(body: any): MpesaCallbackResult | null {
    const callback = body?.Body?.stkCallback
    if (!callback) return null

    const result: MpesaCallbackResult = {
      checkoutRequestId: callback.CheckoutRequestID,
      merchantRequestId: callback.MerchantRequestID,
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc,
      success: callback.ResultCode === 0
    }

    for (const item of callback.CallbackMetadata?.Item || []) {
      if (item.Name === 'Amount') result.amount = item.Value
      if (item.Name === 'MpesaReceiptNumber') result.receiptNumber = item.Value
      if (item.Name === 'PhoneNumber') result.phone = String(item.Value)
    }

    return result
  }
}
