import { Request } from 'express';

export interface NormalizedIncomingMessage {
  fromPhone: string;
  rawFrom: string;
  body: string;
  messageSid: string;
}

export function parseTwilioWhatsappRequest(req: Request): NormalizedIncomingMessage {
  const from = (req.body.From as string) || '';
  const body = (req.body.Body as string) || '';
  const messageSid = (req.body.MessageSid as string) || '';

  return {
    fromPhone: normalizeWhatsappSender(from),
    rawFrom: from,
    body,
    messageSid,
  };
}

/**
 * Twilio sends WhatsApp senders like `whatsapp:+15551234567`.
 * We normalize to E.164 (`+15551234567`) for consistent DB keys.
 */
export function normalizeWhatsappSender(from: string): string {
  const trimmed = from.trim();
  if (trimmed.toLowerCase().startsWith('whatsapp:')) {
    return trimmed.slice('whatsapp:'.length);
  }
  return trimmed;
}

