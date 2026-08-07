import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CartRecoveryService } from '../services/cartRecoveryService'
import { resolveTenant } from './templates'

/**
 * Background job endpoints.
 *
 * The cart-recovery runner is exposed as an HTTP endpoint so it can be driven
 * by an external scheduler (Render Cron, GitHub Actions, cron-job.org) rather
 * than depending on a single long-lived process. It is also run on an interval
 * in-process when CART_RECOVERY_INTERVAL_MINUTES is set — handy for a demo box
 * but not the right choice for multi-instance deployments.
 *
 * Protect with JOBS_SECRET (query param or x-jobs-secret header).
 */
export async function jobRoutes(fastify: FastifyInstance) {
  fastify.post('/api/jobs/cart-recovery', async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = process.env.JOBS_SECRET
    if (secret) {
      const provided =
        (request.query as Record<string, string>)?.secret ||
        (request.headers['x-jobs-secret'] as string | undefined)
      if (provided !== secret) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    }

    try {
      const result = await CartRecoveryService.runDue(resolveTenant, fastify.log)
      fastify.log.info(
        `🛒 Cart recovery run: considered=${result.considered} sent=${result.sent} skipped=${result.skipped} failed=${result.failed} exhausted=${result.exhausted}`
      )
      return { status: 'ok', ...result }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Cart recovery run failed' })
    }
  })

  // Optional in-process scheduler for demos / single-instance deployments
  const intervalMinutes = Number(process.env.CART_RECOVERY_INTERVAL_MINUTES || 0)
  if (intervalMinutes > 0) {
    const timer = setInterval(() => {
      CartRecoveryService.runDue(resolveTenant, fastify.log)
        .then(result => {
          if (result.considered > 0) {
            fastify.log.info(`🛒 Cart recovery tick: sent=${result.sent} skipped=${result.skipped}`)
          }
        })
        .catch(err => fastify.log.error(`❌ Cart recovery tick failed: ${err}`))
    }, intervalMinutes * 60_000)

    timer.unref?.()
    fastify.addHook('onClose', async () => clearInterval(timer))
    fastify.log.info(`⏰ In-process cart recovery scheduled every ${intervalMinutes} minute(s)`)
  }
}
