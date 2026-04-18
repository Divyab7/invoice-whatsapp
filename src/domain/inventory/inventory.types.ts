export type AddProductInput = {
  name: string;
  price: number;
  priceIncludesGst?: boolean;
  hsn?: string;
  gstRate?: number;
  cessRate?: number;
  quantity: number;
  unit?: string;
  lowStockThreshold?: number;
};

export type UpdateStockDeltaInput = {
  productId: string;
  deltaQuantity: number;
};

export type ListInventoryInput = {
  lowStockOnly?: boolean;
};
