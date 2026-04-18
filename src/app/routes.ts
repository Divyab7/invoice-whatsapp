import { Application, Request, Response } from 'express';
import { whatsappWebhookRouter } from '../interfaces/http/whatsappWebhook.controller';

export function registerRoutes(app: Application) {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/webhook/whatsapp', whatsappWebhookRouter);
}

