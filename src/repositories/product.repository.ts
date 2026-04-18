import { ClientSession, Types } from 'mongoose';
import { ProductModel, ProductDocument } from '../models/Product';

export class ProductRepository {
  async findByIdForBusiness(
    businessId: Types.ObjectId,
    productId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ProductDocument | null> {
    return ProductModel.findOne({ _id: productId, business: businessId, isActive: true }).session(session ?? null);
  }

  async findActiveByNameCaseInsensitive(
    businessId: Types.ObjectId,
    name: string,
    session?: ClientSession,
  ): Promise<ProductDocument[]> {
    return ProductModel.find({
      business: businessId,
      isActive: true,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    }).session(session ?? null);
  }

  async create(
    input: {
      businessId: Types.ObjectId;
      name: string;
      price: number;
      priceIncludesGst?: boolean;
      hsn?: string;
      gstRate?: number;
      cessRate?: number;
      quantity: number;
      unit?: string;
      lowStockThreshold?: number;
    },
    session?: ClientSession,
  ): Promise<ProductDocument> {
    return ProductModel.create(
      [
        {
          business: input.businessId,
          name: input.name,
          price: input.price,
          priceIncludesGst: input.priceIncludesGst ?? true,
          hsn: input.hsn,
          gstRate: input.gstRate,
          cessRate: input.cessRate,
          quantity: input.quantity,
          unit: input.unit,
          lowStockThreshold: input.lowStockThreshold,
          isActive: true,
        },
      ],
      { session },
    ).then((docs) => docs[0]!);
  }

  async listForBusiness(
    businessId: Types.ObjectId,
    opts?: { lowStockOnly?: boolean },
    session?: ClientSession,
  ): Promise<ProductDocument[]> {
    const filter: Record<string, unknown> = { business: businessId, isActive: true };
    if (opts?.lowStockOnly) {
      filter.lowStockThreshold = { $ne: null };
      filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }

    return ProductModel.find(filter).sort({ name: 1 }).session(session ?? null);
  }

  /**
   * Atomically decrement stock if enough quantity exists.
   * Returns the updated document or null if not enough stock.
   */
  async decrementStockIfPossible(
    businessId: Types.ObjectId,
    productId: Types.ObjectId,
    qty: number,
    session?: ClientSession,
  ): Promise<ProductDocument | null> {
    return ProductModel.findOneAndUpdate(
      { _id: productId, business: businessId, isActive: true, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } },
      { new: true, session },
    );
  }

  /**
   * Atomically increment stock (used for compensating decrements on failure).
   */
  async incrementStock(
    businessId: Types.ObjectId,
    productId: Types.ObjectId,
    qty: number,
    session?: ClientSession,
  ): Promise<ProductDocument | null> {
    return ProductModel.findOneAndUpdate(
      // Don't require isActive=true: cancellations/restores should work even if product was later deactivated.
      { _id: productId, business: businessId },
      { $inc: { quantity: qty } },
      { new: true, session },
    );
  }

  async updatePriceAndDeltaQuantity(
    businessId: Types.ObjectId,
    productId: Types.ObjectId,
    deltaQuantity: number,
    newPrice?: number,
    session?: ClientSession,
  ): Promise<ProductDocument | null> {
    const update: Record<string, unknown> = { $inc: { quantity: deltaQuantity } };
    if (typeof newPrice === 'number') {
      update.$set = { price: newPrice };
    }

    // Prevent negative stock if decrementing.
    const filter: Record<string, unknown> = { _id: productId, business: businessId, isActive: true };
    if (deltaQuantity < 0) {
      filter.quantity = { $gte: Math.abs(deltaQuantity) };
    }

    return ProductModel.findOneAndUpdate(filter, update, { new: true, session });
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
