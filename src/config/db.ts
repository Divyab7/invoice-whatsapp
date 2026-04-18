import mongoose from 'mongoose';
import { logger } from './logger';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_invoice';

export async function connectDb(): Promise<void> {
  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');
    throw err;
  }
}

