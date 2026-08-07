import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { TemplateService, TEMPLATE_LIBRARY } from '../services/templateService'
import { WhatsAppService, WhatsAppTenant } from '../services/whatsappService'

/**
 * Template management API.
 *
 * The point of these endpoints is that a client never opens the Meta console:
 * seed the pre-built library, submit it, poll status. The dashboard can drive
 * all of it. See docs/whatsapp-commerce-competitive-playbook.md §4.
 */
export async function templateRoutes(fastify: FastifyInstance) {
  // The library itself (static — useful for the dashboard preview)
  fastify.get('/api/templates/library', async () => ({
    templates: TEMPLATE_LIBRARY.map(t => ({
      purpose: t.purpose,
      name: t.name,
      language: t.language,
      category: t.category,
      bodyText: t.bodyText,
      placeholderCount: t.placeholderCount
    }))
  }))

  // Templates stored for an installation, with live status
  fastify.get('/api/templates/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { installationId } = request.params as { installationId: string }
    try {
      const templates = await TemplateService.list(installationId)
      return { templates, count: templates.length }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Failed to list templates' })
    }
  })

  // Seed the default library (idempotent)
  fastify.post('/api/templates/:installationId/seed', async (request: FastifyRequest, reply: FastifyReply) => {
    const { installationId } = request.params as { installationId: string }
    try {
      const seeded = await TemplateService.seedLibrary(installationId)
      const templates = await TemplateService.list(installationId)
      return { seeded, total: templates.length, templates }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Failed to seed template library' })
    }
  })

  // Submit all LOCAL/REJECTED templates to Meta for review
  fastify.post('/api/templates/:installationId/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { installationId } = request.params as { installationId: string }
    try {
      const tenant = await resolveTenant(installationId)
      if (!tenant) return reply.status(400).send({ error: 'No WhatsApp config for this installation' })
      if (!tenant.wabaId) return reply.status(400).send({ error: 'wabaId is required to manage templates' })

      const result = await TemplateService.submitAllPending(installationId, tenant, fastify.log)
      const templates = await TemplateService.list(installationId)
      return { ...result, templates }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Failed to submit templates' })
    }
  })

  // Pull current approval statuses from Meta
  fastify.post('/api/templates/:installationId/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const { installationId } = request.params as { installationId: string }
    try {
      const tenant = await resolveTenant(installationId)
      if (!tenant) return reply.status(400).send({ error: 'No WhatsApp config for this installation' })

      const result = await TemplateService.syncStatuses(installationId, tenant, fastify.log)
      const templates = await TemplateService.list(installationId)
      return { ...result, templates }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Failed to sync template statuses' })
    }
  })
}

/** Per-installation WhatsApp config, falling back to env vars (single tenant). */
export async function resolveTenant(installationId: string): Promise<WhatsAppTenant | null> {
  const configs = await prisma.$queryRaw`
    SELECT "phoneNumberId", "accessToken", "catalogId", "wabaId"
    FROM whatsapp_configs
    WHERE "installationId" = ${installationId}
    LIMIT 1
  ` as any[]

  if (configs.length) {
    return {
      phoneNumberId: configs[0].phoneNumberId,
      accessToken: configs[0].accessToken,
      catalogId: configs[0].catalogId,
      wabaId: configs[0].wabaId
    }
  }

  const envTenant = WhatsAppService.envTenant()
  return envTenant.accessToken && envTenant.phoneNumberId ? envTenant : null
}
