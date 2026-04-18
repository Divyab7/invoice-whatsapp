import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { SYSTEM_PROMPT } from './promptTemplates';
import {
  addInventorySchema,
  cancelInvoiceSchema,
  createInvoiceSchema,
  getInventorySchema,
  markPaymentSchema,
  updateStockSchema,
  toOpenAiToolParameters,
} from './tools';
import { NormalizedIncomingMessage } from './messageParser';
import { UserModel } from '../models/User';
import { BusinessModel } from '../models/Business';
import { AiInteractionLogModel } from '../models/AiInteractionLog';
import { Types } from 'mongoose';
import { dispatchToolCall } from './toolDispatcher';

if (!env.openaiApiKey) {
  logger.warn('OPENAI_API_KEY is not set; AI calls will fail.');
}

const openai = new OpenAI({
  apiKey: env.openaiApiKey,
});

export interface OrchestratorResult {
  replyText: string;
}

export async function handleIncomingMessage(
  message: NormalizedIncomingMessage,
): Promise<OrchestratorResult> {
  const { fromPhone, rawFrom, body } = message;

  // Resolve or create user + business (simple first-touch onboarding).
  let user =
    (await UserModel.findOne({ phoneE164: fromPhone }).populate('business')) ??
    (await UserModel.findOne({ phoneE164: rawFrom }).populate('business'));

  if (!user) {
    const business = await BusinessModel.create({
      name: `Business ${fromPhone}`,
    });

    user = await UserModel.create({
      phoneE164: fromPhone,
      business: business._id,
      language: 'en',
      role: 'owner',
    });
  } else if (user.phoneE164 !== fromPhone) {
    // Migrate older records that stored `whatsapp:+...` into normalized E.164.
    user.phoneE164 = fromPhone;
    await user.save();
  }

  const businessId = new Types.ObjectId(
    typeof user.business === 'object' && user.business && '_id' in user.business
      ? String((user.business as any)._id)
      : String(user.business),
  );

  // TODO: integrate conversation history and session state for multi-turn flows.

  try {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'addInventory',
          description: 'Add a product to inventory',
          parameters: toOpenAiToolParameters(addInventorySchema),
        },
      },
      {
        type: 'function',
        function: {
          name: 'updateStock',
          description: 'Update stock quantity for an existing product',
          parameters: toOpenAiToolParameters(updateStockSchema),
        },
      },
      {
        type: 'function',
        function: {
          name: 'getInventory',
          description: 'View current stock levels',
          parameters: toOpenAiToolParameters(getInventorySchema),
        },
      },
      {
        type: 'function',
        function: {
          name: 'createInvoice',
          description: 'Create an invoice for a customer',
          parameters: toOpenAiToolParameters(createInvoiceSchema),
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancelInvoice',
          description: 'Cancel an unpaid invoice and restore inventory stock from its line items',
          parameters: toOpenAiToolParameters(cancelInvoiceSchema),
        },
      },
      {
        type: 'function',
        function: {
          name: 'markPayment',
          description: 'Record a payment against an invoice',
          parameters: toOpenAiToolParameters(markPaymentSchema),
        },
      },
    ] as any;

    if (!env.openaiApiKey) {
      return {
        replyText:
          'OpenAI is not configured on the server yet (missing OPENAI_API_KEY). Add it to `.env` and restart `npm run dev`.',
      };
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: body },
      ],
      tools,
      tool_choice: 'auto',
    });

    const messageResult = completion.choices[0].message;

    let replyText = 'Sorry, I could not understand that.';
    if (messageResult.tool_calls && messageResult.tool_calls.length > 0) {
      const parts: string[] = [];
      for (const call of messageResult.tool_calls) {
        // OpenAI tool calls use function.name + function.arguments
        const name = (call as any).function?.name as string | undefined;
        const args = (call as any).function?.arguments as string | undefined;
        if (!name) continue;
        const result = await dispatchToolCall(businessId, name, args ?? '{}');
        parts.push(result);
      }
      replyText = parts.join('\n\n');
    } else if (messageResult.content) {
      replyText = messageResult.content.toString();
    }

    await AiInteractionLogModel.create({
      user: user._id,
      business: businessId,
      rawMessage: body,
      toolsInvoked:
        messageResult.tool_calls?.map((t) => ({
          name: t.function.name,
          arguments: JSON.parse(t.function.arguments || '{}'),
        })) ?? [],
      resultSummary: replyText.slice(0, 500),
    });

    return { replyText };
  } catch (err: any) {
    logger.error({ err }, 'AI orchestrator error');
    await AiInteractionLogModel.create({
      user: user._id,
      business: businessId,
      rawMessage: body,
      toolsInvoked: [],
      error: err?.message || 'unknown error',
    });

    return {
      replyText: 'Something went wrong while processing your request. Please try again.',
    };
  }
}

