import twilio from 'twilio';
import { env } from './env';

export function getTwilioClient() {
  if (!env.twilio.accountSid || !env.twilio.authToken) {
    return null;
  }
  return twilio(env.twilio.accountSid, env.twilio.authToken);
}

export async function sendWhatsappReply(toWhatsAppAddress: string, body: string) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error('Twilio is not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
  }
  if (!env.twilio.whatsappNumber) {
    throw new Error('Twilio WhatsApp sender is not configured (missing TWILIO_WHATSAPP_NUMBER).');
  }

  await client.messages.create({
    from: env.twilio.whatsappNumber,
    to: toWhatsAppAddress,
    body,
  });
}
