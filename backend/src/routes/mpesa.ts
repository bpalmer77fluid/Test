import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { MpesaService } from '../services/mpesaService'
import { WhatsAppService } from '../services/whatsappService'

/**
 * M-Pesa Daraja callback endpoint. Safaricom POSTs the STK push result here;
 * we settle the payment record, flip the order, and close the loop in WhatsApp.
 */
export async function mpesaRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhook/mpesa/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO(security): restrict by Safaricom IP allowlist or a secret path segment;
      // Daraja callbacks carry no signature.
      const result = MpesaService.parseCallback(request.body)
      if (!result) {
        fastify.log.warn('⚠️ Unrecognized M-Pesa callback payload')
        return reply.send({ ResultCode: 0, ResultDesc: 'Accepted' })
      }

      fastify.log.info(`💰 M-Pesa callback ${result.checkoutRequestId}: ${result.success ? 'PAID' : 'FAILED'} (${result.resultDescription})`)

      const payments = await prisma.$queryRaw`
        UPDATE mpesa_payments
        SET status = ${result.success ? 'success' : 'failed'},
            "receiptNumber" = ${result.receiptNumber || null},
            "resultDescription" = ${result.resultDescription},
            "rawCallback" = ${JSON.stringify(request.body)}::jsonb,
            "updatedAt" = NOW()
        WHERE "checkoutRequestId" = ${result.checkoutRequestId}
        RETURNING "installationId", "orderReference", phone, amount
      ` as any[]

      if (!payments.length) {
        fastify.log.warn(`⚠️ No mpesa_payments row for checkoutRequestId ${result.checkoutRequestId}`)
        return reply.send({ ResultCode: 0, ResultDesc: 'Accepted' })
      }

      const payment = payments[0]

      if (result.success) {
        await prisma.$executeRaw`
          UPDATE orders
          SET status = 'paid', "updatedAt" = NOW()
          WHERE "installationId" = ${payment.installationId} AND "fluidOrderId" = ${payment.orderReference}
        `

        // TODO(fluid-order): mark the order paid in Fluid via the platform API
        // so fulfillment and rep commission events fire upstream.

        await WhatsAppService.sendOrderConfirmation(
          payment.phone,
          payment.orderReference,
          Number(payment.amount),
          `Payment received ✅ (M-Pesa ref ${result.receiptNumber}). We are preparing your order.`
        ).catch(err => fastify.log.error(`❌ Failed to send WhatsApp receipt: ${err}`))
      } else {
        await WhatsAppService.sendText(
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
