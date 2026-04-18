export type GstSplit = {
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  lineTotal: number;
};

export function computeLineGstIndia(params: {
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  cessRate?: number;
  /** If true, unitPrice includes GST (typical retail). If false, GST is added on top. */
  priceIncludesGst: boolean;
}): GstSplit {
  const qty = params.quantity;
  const unitPrice = params.unitPrice;
  const gstRate = params.gstRate ?? 0;
  const cessRate = params.cessRate ?? 0;

  const lineMoney = round2(unitPrice * qty);

  let taxableValue = lineMoney;
  let gstAmount = 0;
  let cess = 0;

  if (params.priceIncludesGst) {
    // MRP/sticker style: lineMoney includes GST and (if configured) CESS.
    const combinedRate = gstRate + cessRate;
    if (combinedRate > 0) {
      taxableValue = round2(lineMoney / (1 + combinedRate / 100));
    } else {
      taxableValue = lineMoney;
    }

    gstAmount = gstRate > 0 ? round2(taxableValue * (gstRate / 100)) : 0;
    cess = cessRate > 0 ? round2(taxableValue * (cessRate / 100)) : 0;
  } else {
    // Tax-exclusive line money is treated as pre-tax taxable value.
    taxableValue = lineMoney;
    gstAmount = gstRate > 0 ? round2(taxableValue * (gstRate / 100)) : 0;
    cess = cessRate > 0 ? round2(taxableValue * (cessRate / 100)) : 0;
  }

  // Intra-state default: split equally into CGST/SGST. IGST stays 0 until interstate mode exists.
  const half = round2(gstAmount / 2);
  const cgst = half;
  const sgst = round2(gstAmount - half); // fix rounding penny drift

  const lineTotal = round2(taxableValue + gstAmount + cess);

  return {
    taxableValue,
    gstRate,
    gstAmount,
    cgst,
    sgst,
    igst: 0,
    cess,
    lineTotal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
