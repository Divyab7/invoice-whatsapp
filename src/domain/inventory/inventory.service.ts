import { ClientSession, Types } from 'mongoose';
import { ProductRepository } from '../../repositories/product.repository';
import { AddProductInput, ListInventoryInput, UpdateStockDeltaInput } from './inventory.types';
import { ValidationError } from '../../utils/errors';

export class InventoryService {
  constructor(private readonly products = new ProductRepository()) {}

  async addProduct(businessId: Types.ObjectId, input: AddProductInput, session?: ClientSession) {
    return this.products.create(
      {
        businessId,
        name: input.name.trim(),
        price: input.price,
        priceIncludesGst: input.priceIncludesGst,
        hsn: input.hsn,
        gstRate: input.gstRate,
        cessRate: input.cessRate,
        quantity: input.quantity,
        unit: input.unit,
        lowStockThreshold: input.lowStockThreshold,
      },
      session,
    );
  }

  async updateStock(businessId: Types.ObjectId, input: UpdateStockDeltaInput, session?: ClientSession) {
    if (!Types.ObjectId.isValid(input.productId)) {
      throw new ValidationError('Invalid productId');
    }

    const productId = new Types.ObjectId(input.productId);
    const updated = await this.products.updatePriceAndDeltaQuantity(
      businessId,
      productId,
      input.deltaQuantity,
      undefined,
      session,
    );

    if (!updated) {
      throw new ValidationError('Unable to update stock (product not found or insufficient stock)');
    }

    return updated;
  }

  async getInventory(businessId: Types.ObjectId, input: ListInventoryInput, session?: ClientSession) {
    return this.products.listForBusiness(businessId, { lowStockOnly: input.lowStockOnly }, session);
  }
}
