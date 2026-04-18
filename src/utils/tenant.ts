import { Request } from 'express';
import { UserModel } from '../models/User';

export interface TenantContext {
  userId: string;
  businessId: string;
}

// For WhatsApp flows, tenant context is resolved in the AI orchestrator using the From number.
// For future HTTP APIs (e.g., dashboard), this helper can be used with auth middleware.
export async function resolveTenantFromPhone(phoneE164: string): Promise<TenantContext | null> {
  const user = await UserModel.findOne({ phoneE164 });
  if (!user) return null;
  return {
    userId: user._id.toString(),
    businessId: user.business.toString(),
  };
}

export function getTenantFromRequest(req: Request): TenantContext | null {
  const businessId = (req as any).businessId as string | undefined;
  const userId = (req as any).userId as string | undefined;
  if (!businessId || !userId) return null;
  return { businessId, userId };
}

