import crypto from 'crypto'
 
 
  export const verifyWebhookSignature = (
	webhookBody,
	webhookSignature,
	webhookSecret,
  ) => {
	try {
	  const expectedSignature = crypto
		.createHmac('sha256', webhookSecret)
		.update(webhookBody)
		.digest('hex');

	  return crypto.timingSafeEqual(
		Buffer.from(expectedSignature),
		Buffer.from(webhookSignature)
	  );
	} catch (error) {
	  console.error('Webhook signature verification failed:', error);
	  return false;
	}
  };

