import { PaymentError, hash, paymentConfig, verifyWebhookSignature } from '../lib/paymentDomain';
import { paymentRepository } from '../repositories/paymentRepository';

export const paymentWebhookService = {
  async receive(input: { signature?: string; requestId?: string; queryId: unknown; body: any }) {
    const config = paymentConfig();
    const signedDelivery = verifyWebhookSignature({ signature: input.signature, requestId: input.requestId,
      dataId: input.queryId, bodyId: input.body?.data?.id, secret: config.webhookSecret });
    const body = input.body;
    if (body.type !== 'order') return;
    if (String(body.user_id) !== config.sellerId || typeof body.live_mode !== 'boolean' ||
        (config.environment === 'PRODUCTION' && !body.live_mode)) {
      throw new PaymentError(400, 'Notificação de outra conta ou ambiente.', 'WEBHOOK_ACCOUNT');
    }
    const fingerprint = hash(`${config.environment}:${config.sellerId}:${signedDelivery}`);
    await paymentRepository.enqueueWebhook({ fingerprint, orderId: body.data.id,
      sellerId: config.sellerId, environment: config.environment });
  },
};
