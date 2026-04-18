import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { json, urlencoded } from 'body-parser';
import { registerRoutes } from './routes';
import { connectDb } from '../config/db';
import { logger } from '../config/logger';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function bootstrap() {
  await connectDb();

  const app: Application = express();

  app.use(helmet());
  app.use(cors());
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }),
  );

  registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    const status = err.statusCode || 500;
    res.status(status).json({
      error: {
        message: status === 500 ? 'Internal server error' : err.message,
      },
    });
  });

  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

