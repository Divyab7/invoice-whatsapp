import { Router, Request, Response, NextFunction } from 'express';
import { parseTwilioWhatsappRequest } from '../../ai/messageParser';
import { handleIncomingMessage } from '../../ai/agentOrchestrator';
import { logger } from '../../config/logger';
import { sendWhatsappReply } from '../../config/twilio';

export const whatsappWebhookRouter = Router();

// POST /webhook/whatsapp
whatsappWebhookRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const normalized = parseTwilioWhatsappRequest(req);
      const result = await handleIncomingMessage(normalized);

      logger.info(
        {
          from: normalized.fromPhone,
        },
        'Processed WhatsApp message',
      );

      // Prefer outbound WhatsApp messaging via Twilio REST API (works well with webhooks).
      // If Twilio isn't configured locally, fall back to returning plain text in the HTTP response.
      try {
        await sendWhatsappReply(normalized.rawFrom, result.replyText);
        res.status(204).end();
      } catch (e) {
        logger.warn({ e }, 'Twilio outbound send failed; falling back to HTTP body response');
        res.status(200).type('text/plain').send(result.replyText);
      }
    } catch (err) {
      next(err);
    }
  },
);

