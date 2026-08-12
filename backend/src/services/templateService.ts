import { prisma } from '../db'
import { WhatsAppTenant } from './whatsappService'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

/**
 * Message template manager.
 *
 * Messaging a customer outside WhatsApp's 24-hour customer-service window
 * requires a Meta-approved template. Clients should never have to write or
 * submit one by hand, so we ship a pre-built library, submit it to Meta on
 * their behalf, and track approval status.
 */
export type TemplatePurpose =
  | 'cart_recovery_1'
  | 'cart_recovery_2'
  | 'cart_recovery_3'
  | 'order_receipt'
  | 'order_status'
  | 'payment_failed'

export interface TemplateDefinition {
  purpose: TemplatePurpose
  name: string
  language: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  bodyText: string
  headerText?: string
  footerText?: string
  buttons?: unknown
  placeholderCount: number
  /** Sample values Meta requires to review placeholders. */
  example: string[]
}

/**
 * Default library. Deliberately compliant for direct selling: no health
 * claims, no income claims, no unverifiable superlatives — see
 * docs/whatsapp-commerce-competitive-playbook.md §5.
 *
 * UTILITY = tied to a transaction the customer initiated (cheaper, higher
 * deliverability). MARKETING = promotional, needs marketing opt-in.
 */
export const TEMPLATE_LIBRARY: TemplateDefinition[] = [
  {
    purpose: 'cart_recovery_1',
    name: 'cart_reminder_pending_payment',
    language: 'en',
    category: 'UTILITY',
    bodyText:
      'Hi {{1}}, your order {{2}} for KSh {{3}} is still waiting for payment. Reply *pay* and we will send the M-Pesa prompt again.',
    footerText: 'Reply STOP to opt out',
    placeholderCount: 3,
    example: ['Amina', 'WA-K3LM9Q', '3,291']
  },
  {
    purpose: 'cart_recovery_2',
    name: 'cart_reminder_assurance',
    language: 'en',
    category: 'UTILITY',
    bodyText:
      'Hi {{1}}, order {{2}} is still open. You pay by M-Pesa only after you confirm, and you can collect at our Nairobi office or choose delivery. Reply *pay* to continue or *help* to talk to us.',
    footerText: 'Reply STOP to opt out',
    placeholderCount: 2,
    example: ['Amina', 'WA-K3LM9Q']
  },
  {
    purpose: 'cart_recovery_3',
    name: 'cart_reminder_final',
    language: 'en',
    category: 'UTILITY',
    bodyText:
      'Hi {{1}}, this is the last reminder for order {{2}} (KSh {{3}}). Reply *pay* to complete it, or *cancel* and we will close it.',
    footerText: 'Reply STOP to opt out',
    placeholderCount: 3,
    example: ['Amina', 'WA-K3LM9Q', '3,291']
  },
  {
    purpose: 'order_receipt',
    name: 'order_payment_received',
    language: 'en',
    category: 'UTILITY',
    bodyText:
      'Payment received for order {{1}}. Amount: KSh {{2}}. M-Pesa reference: {{3}}. We are preparing your order.',
    placeholderCount: 3,
    example: ['WA-K3LM9Q', '3,291', 'TEST123XYZ']
  },
  {
    purpose: 'order_status',
    name: 'order_status_update',
    language: 'en',
    category: 'UTILITY',
    bodyText: 'Update on order {{1}}: {{2}}.',
    placeholderCount: 2,
    example: ['WA-K3LM9Q', 'ready for collection at our Nairobi office']
  },
  {
    purpose: 'payment_failed',
    name: 'payment_not_completed',
    language: 'en',
    category: 'UTILITY',
    bodyText:
      'Payment for order {{1}} was not completed ({{2}}). Reply *pay* to try again.',
    placeholderCount: 2,
    example: ['WA-K3LM9Q', 'request cancelled by user']
  }
]

export interface StoredTemplate {
  id: string
  purpose: string
  name: string
  language: string
  status: string
  placeholderCount: number
  metaTemplateId: string | null
}

export class TemplateService {
  /** Insert the default library for an installation (idempotent). */
  static async seedLibrary(installationId: string): Promise<number> {
    let seeded = 0

    for (const def of TEMPLATE_LIBRARY) {
      const result = await prisma.$executeRaw`
        INSERT INTO message_templates (
          id, "installationId", purpose, name, language, category,
          "bodyText", "headerText", "footerText", buttons, "placeholderCount",
          status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${installationId}, ${def.purpose}, ${def.name},
          ${def.language}, ${def.category}, ${def.bodyText},
          ${def.headerText || null}, ${def.footerText || null},
          ${def.buttons ? JSON.stringify(def.buttons) : null}::jsonb,
          ${def.placeholderCount}::integer, 'LOCAL', NOW(), NOW()
        )
        ON CONFLICT ("installationId", name, language) DO NOTHING
      `
      seeded += result
    }

    return seeded
  }

  static async list(installationId: string): Promise<StoredTemplate[]> {
    return await prisma.$queryRaw`
      SELECT id, purpose, name, language, status, "placeholderCount", "metaTemplateId"
      FROM message_templates
      WHERE "installationId" = ${installationId}
      ORDER BY purpose ASC
    ` as StoredTemplate[]
  }

  /**
   * Resolve an APPROVED template for a purpose. Returns null when nothing is
   * approved yet — callers must fall back to a free-form message (only legal
   * inside the 24-hour window) or skip the send.
   */
  static async getApproved(
    installationId: string,
    purpose: TemplatePurpose,
    language = 'en'
  ): Promise<StoredTemplate | null> {
    const rows = await prisma.$queryRaw`
      SELECT id, purpose, name, language, status, "placeholderCount", "metaTemplateId"
      FROM message_templates
      WHERE "installationId" = ${installationId}
        AND purpose = ${purpose}
        AND language = ${language}
        AND status = 'APPROVED'
      LIMIT 1
    ` as StoredTemplate[]
    return rows[0] || null
  }

  /** Submit one local template to Meta for review. */
  static async submitToMeta(
    tenant: WhatsAppTenant,
    templateId: string,
    log?: { info: (m: string) => void; warn: (m: string) => void }
  ): Promise<{ submitted: boolean; error?: string }> {
    if (!tenant.wabaId) return { submitted: false, error: 'No wabaId configured for this tenant' }

    const rows = await prisma.$queryRaw`
      SELECT id, purpose, name, language, category, "bodyText", "headerText",
             "footerText", buttons, "placeholderCount"
      FROM message_templates WHERE id = ${templateId} LIMIT 1
    ` as any[]
    if (!rows.length) return { submitted: false, error: 'Template not found' }
    const tpl = rows[0]

    const definition = TEMPLATE_LIBRARY.find(d => d.name === tpl.name)
    const example = definition?.example || Array.from({ length: tpl.placeholderCount }, (_, i) => `sample${i + 1}`)

    const components: any[] = []
    if (tpl.headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: tpl.headerText })
    }
    const body: any = { type: 'BODY', text: tpl.bodyText }
    if (tpl.placeholderCount > 0) {
      body.example = { body_text: [example.slice(0, tpl.placeholderCount)] }
    }
    components.push(body)
    if (tpl.footerText) components.push({ type: 'FOOTER', text: tpl.footerText })
    if (tpl.buttons) components.push({ type: 'BUTTONS', buttons: tpl.buttons })

    try {
      const response = await fetch(`${GRAPH_API_BASE}/${tenant.wabaId}/message_templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tenant.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          components
        })
      })

      const payload: any = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = payload?.error?.error_user_msg || payload?.error?.message || `HTTP ${response.status}`
        await prisma.$executeRaw`
          UPDATE message_templates
          SET status = 'REJECTED', "rejectionReason" = ${String(message).slice(0, 500)},
              "lastSyncedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = ${templateId}
        `
        log?.warn(`⚠️ Template ${tpl.name} submission failed: ${message}`)
        return { submitted: false, error: String(message) }
      }

      await prisma.$executeRaw`
        UPDATE message_templates
        SET status = ${payload.status || 'PENDING'}, "metaTemplateId" = ${payload.id || null},
            "rejectionReason" = null, "lastSyncedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = ${templateId}
      `
      log?.info(`📤 Template ${tpl.name} submitted to Meta (${payload.id})`)
      return { submitted: true }
    } catch (err) {
      log?.warn(`⚠️ Template ${tpl.name} submission error: ${err}`)
      return { submitted: false, error: String(err) }
    }
  }

  /** Submit every LOCAL or REJECTED template for an installation. */
  static async submitAllPending(
    installationId: string,
    tenant: WhatsAppTenant,
    log?: { info: (m: string) => void; warn: (m: string) => void }
  ): Promise<{ submitted: number; failed: number }> {
    const pending = await prisma.$queryRaw`
      SELECT id FROM message_templates
      WHERE "installationId" = ${installationId} AND status IN ('LOCAL', 'REJECTED')
    ` as any[]

    let submitted = 0
    let failed = 0
    for (const row of pending) {
      const result = await this.submitToMeta(tenant, row.id, log)
      result.submitted ? submitted++ : failed++
    }
    return { submitted, failed }
  }

  /**
   * Pull current statuses from Meta. Approval is asynchronous, so this must be
   * polled (or driven by the message_template_status_update webhook field).
   */
  static async syncStatuses(
    installationId: string,
    tenant: WhatsAppTenant,
    log?: { info: (m: string) => void; warn: (m: string) => void }
  ): Promise<{ updated: number }> {
    if (!tenant.wabaId) return { updated: 0 }

    const response = await fetch(
      `${GRAPH_API_BASE}/${tenant.wabaId}/message_templates?fields=id,name,language,status,category&limit=200`,
      { headers: { Authorization: `Bearer ${tenant.accessToken}` } }
    )

    if (!response.ok) {
      log?.warn(`⚠️ Template status sync failed: HTTP ${response.status}`)
      return { updated: 0 }
    }

    const payload: any = await response.json()
    let updated = 0

    for (const remote of payload.data || []) {
      const result = await prisma.$executeRaw`
        UPDATE message_templates
        SET status = ${remote.status}, "metaTemplateId" = ${remote.id},
            "lastSyncedAt" = NOW(), "updatedAt" = NOW()
        WHERE "installationId" = ${installationId}
          AND name = ${remote.name}
          AND language = ${remote.language}
          AND status <> ${remote.status}
      `
      updated += result
    }

    log?.info(`🔄 Template status sync: ${updated} updated`)
    return { updated }
  }
}
