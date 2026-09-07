import {
  Order,
  OrderWithCalculations,
  OrderProfitResult,
  SKUCost,
  GSTSettings,
  RTOSettings,
  AdsCostEntry,
  AdAllocationMethod,
  SKUAggregate,
  MonthlyAggregate,
  OrderStatus,
  CalculationStatus,
} from "@/types";
import {
  parseNumeric,
  safeDivide,
  getMonthKey,
  formatMonthYear,
} from "@/lib/utils";

export function calculatePurchaseGSTComponents(
  purchaseCostInclGST: number | null,
  gstRate: number | null,
): {
  taxableCost: number | null;
  inputGST: number | null;
} {
  if (
    purchaseCostInclGST === null ||
    purchaseCostInclGST === undefined ||
    isNaN(purchaseCostInclGST) ||
    gstRate === null ||
    gstRate === undefined ||
    isNaN(gstRate)
  ) {
    return { taxableCost: null, inputGST: null };
  }
  const divisor = 1 + gstRate / 100;
  const taxableCost = purchaseCostInclGST / divisor;
  const inputGST = purchaseCostInclGST - taxableCost;
  return { taxableCost, inputGST };
}

export function calculateOutputGST(
  finalSettlementAmount: number | null,
  actualGSTAmountInSettlement: number | null,
  sellingGSTRate: number,
  gstRegistered: boolean,
): {
  outputGST: number | null;
  isEstimated: boolean;
  gstExclusiveSettlement: number | null;
} {
  if (
    finalSettlementAmount === null ||
    finalSettlementAmount === undefined ||
    isNaN(finalSettlementAmount)
  ) {
    return { outputGST: null, isEstimated: false, gstExclusiveSettlement: null };
  }

  if (
    actualGSTAmountInSettlement !== null &&
    actualGSTAmountInSettlement !== undefined &&
    !isNaN(actualGSTAmountInSettlement)
  ) {
    const outputGST = actualGSTAmountInSettlement;
    return {
      outputGST,
      isEstimated: false,
      gstExclusiveSettlement: finalSettlementAmount - outputGST,
    };
  }

  if (gstRegistered && finalSettlementAmount > 0) {
    const divisor = 1 + sellingGSTRate / 100;
    const gstExclusiveSettlement = finalSettlementAmount / divisor;
    const outputGST = finalSettlementAmount - gstExclusiveSettlement;
    return { outputGST, isEstimated: true, gstExclusiveSettlement };
  }

  return {
    outputGST: null,
    isEstimated: false,
    gstExclusiveSettlement: finalSettlementAmount,
  };
}

export function calculateMarginPercent(
  profit: number | null,
  settlement: number | null,
): number | null {
  if (
    profit === null ||
    profit === undefined ||
    isNaN(profit) ||
    settlement === null ||
    settlement === undefined ||
    isNaN(settlement) ||
    settlement <= 0
  ) {
    return null;
  }
  return (profit / settlement) * 100;
}

export function calculateProfitPercent(
  profit: number | null,
  cogs: number | null,
): number | null {
  if (
    profit === null ||
    profit === undefined ||
    isNaN(profit) ||
    cogs === null ||
    cogs === undefined ||
    isNaN(cogs) ||
    cogs === 0
  ) {
    return null;
  }
  return (profit / cogs) * 100;
}

export function calculateOrderProfit(
  order: Order,
  skuCost: SKUCost | undefined,
  gstSettings: GSTSettings,
  rtoSettings: RTOSettings,
  adAllocationPerOrder: number | null,
): OrderProfitResult {
  const warnings: string[] = [];
  const settlement =
    order.finalSettlementAmount !== null &&
    order.finalSettlementAmount !== undefined &&
    !isNaN(order.finalSettlementAmount)
      ? order.finalSettlementAmount
      : null;

  const quantity = order.quantity ?? 1;
  const status = order.liveOrderStatus;

  const purchaseCostPerUnitInclGST =
    skuCost?.purchaseCostInclGST !== null &&
    skuCost?.purchaseCostInclGST !== undefined &&
    !isNaN(skuCost.purchaseCostInclGST)
      ? skuCost.purchaseCostInclGST
      : null;

  const hasMissingCost = purchaseCostPerUnitInclGST === null;

  const gstRate =
    skuCost?.gstRate ??
    order.productGSTPercent ??
    gstSettings.purchaseGSTRate;

  const perUnit = calculatePurchaseGSTComponents(
    purchaseCostPerUnitInclGST,
    gstRate,
  );

  let totalPurchaseCostInclGST: number | null = null;
  let totalPurchaseCostExclGST: number | null = null;
  let totalInputGST: number | null = null;

  if (purchaseCostPerUnitInclGST !== null) {
    totalPurchaseCostInclGST = quantity * purchaseCostPerUnitInclGST;
    if (perUnit.taxableCost !== null) {
      totalPurchaseCostExclGST = quantity * perUnit.taxableCost;
    }
    if (perUnit.inputGST !== null) {
      totalInputGST = quantity * perUnit.inputGST;
    }
  }

  if (status === "RTO") {
    if (!rtoSettings.chargeProductCostOnRTO) {
      totalPurchaseCostInclGST = 0;
      totalPurchaseCostExclGST = 0;
      totalInputGST = 0;
    }
  }

  if (status === "Cancelled") {
    if (settlement !== null && settlement > 0) {
      warnings.push("Cancelled order has settlement amount — review required");
    }
  }

  const outGST = calculateOutputGST(
    settlement,
    order.actualGSTAmount ?? null,
    gstSettings.sellingGSTRate,
    gstSettings.gstRegistered,
  );

  let cashProfitBeforeAds: number | null = null;
  if (settlement !== null && totalPurchaseCostInclGST !== null) {
    cashProfitBeforeAds = settlement - totalPurchaseCostInclGST;
  } else if (settlement !== null && status === "RTO" && !rtoSettings.chargeProductCostOnRTO) {
    cashProfitBeforeAds = settlement;
  }

  let allocatedAdCost: number | null = null;
  if (status === "Cancelled" || status === "RTO") {
    allocatedAdCost = 0;
  } else {
    allocatedAdCost = adAllocationPerOrder ?? 0;
  }

  let netCashProfit: number | null = null;
  if (cashProfitBeforeAds !== null) {
    netCashProfit = cashProfitBeforeAds - (allocatedAdCost ?? 0);
  }

  let gstAdjustedProfit: number | null = null;
  let netGSTPayable: number | null = null;
  if (
    gstSettings.gstRegistered &&
    outGST.gstExclusiveSettlement !== null &&
    totalPurchaseCostExclGST !== null
  ) {
    const accountingCOGS = gstSettings.itcEligible
      ? totalPurchaseCostExclGST
      : totalPurchaseCostInclGST ?? totalPurchaseCostExclGST;
    gstAdjustedProfit = outGST.gstExclusiveSettlement - accountingCOGS;

    if (outGST.outputGST !== null) {
      const eligibleInput = gstSettings.itcEligible ? totalInputGST ?? 0 : 0;
      netGSTPayable = outGST.outputGST - eligibleInput;
    }
  }

  const margin = calculateMarginPercent(netCashProfit, settlement);

  let calculationStatus: CalculationStatus;

  if (settlement === null) {
    calculationStatus = "NO_SETTLEMENT";
  } else if (hasMissingCost && status !== "Cancelled" && status !== "RTO") {
    calculationStatus = "COST_MISSING";
  } else if (status === "Cancelled") {
    if (settlement !== null && settlement > 0) {
      calculationStatus = "REVIEW_REQUIRED";
    } else {
      calculationStatus = "CANCELLED";
    }
  } else if (status === "RTO") {
    calculationStatus = "RTO";
  } else if (netCashProfit === null || totalPurchaseCostInclGST === null) {
    calculationStatus = "INVALID_DATA";
  } else if (netCashProfit >= 0) {
    calculationStatus = "PROFIT";
  } else {
    calculationStatus = "LOSS";
  }

  if (settlement !== null && settlement < 0) {
    warnings.push(`Negative settlement of ₹${Math.abs(settlement).toFixed(2)}`);
  }

  return {
    settlement,
    quantity,
    purchaseCostInclGST: totalPurchaseCostInclGST,
    purchaseCostExclGST: totalPurchaseCostExclGST,
    inputGST: totalInputGST,
    outputGST: outGST.outputGST,
    outputGSTEstimated: outGST.isEstimated,
    cashProfitBeforeAds,
    allocatedAdCost,
    netCashProfit,
    gstAdjustedProfit,
    netGSTPayable,
    margin,
    status,
    calculationStatus,
    warnings,
  };
}

export function calculateAdAllocation(
  orders: Order[],
  adsEntries: AdsCostEntry[],
  method: AdAllocationMethod,
): Map<string, number> {
  const result = new Map<string, number>();
  if (method === "none" || adsEntries.length === 0) return result;

  const totalAdCost = adsEntries.reduce(
    (sum, a) => sum + (a.totalAdsCost ?? a.adCost ?? 0),
    0,
  );
  if (totalAdCost <= 0) return result;

  const validOrders = orders.filter(
    (o) =>
      o.liveOrderStatus !== "Cancelled" &&
      o.liveOrderStatus !== "RTO" &&
      o.finalSettlementAmount !== null &&
      o.finalSettlementAmount !== undefined &&
      !isNaN(o.finalSettlementAmount),
  );

  if (validOrders.length === 0) return result;

  if (method === "equal") {
    const perOrder = totalAdCost / validOrders.length;
    validOrders.forEach((o) => result.set(o.id, perOrder));
  } else if (method === "byOrderValue") {
    const totalSettlement = validOrders.reduce(
      (sum, o) => sum + (o.finalSettlementAmount ?? 0),
      0,
    );
    if (totalSettlement > 0) {
      validOrders.forEach((o) => {
        const share =
          ((o.finalSettlementAmount ?? 0) / totalSettlement) * totalAdCost;
        result.set(o.id, share);
      });
    }
  } else if (method === "byQuantity") {
    const totalQty = validOrders.reduce((sum, o) => sum + (o.quantity ?? 0), 0);
    if (totalQty > 0) {
      validOrders.forEach((o) => {
        const share = ((o.quantity ?? 0) / totalQty) * totalAdCost;
        result.set(o.id, share);
      });
    }
  }

  return result;
}

export function enrichOrderWithCalculations(
  order: Order,
  skuCostMap: Map<string, SKUCost>,
  gstSettings: GSTSettings,
  rtoSettings: RTOSettings,
  adAllocationMap: Map<string, number>,
): OrderWithCalculations {
  const skuCost = skuCostMap.get(order.supplierSKU);
  const purchaseCostPerUnit = skuCost?.purchaseCostInclGST ?? null;
  const hasMissingCost =
    purchaseCostPerUnit === null || purchaseCostPerUnit === undefined;

  const gstRate =
    skuCost?.gstRate ?? order.productGSTPercent ?? gstSettings.purchaseGSTRate;

  const perUnit = calculatePurchaseGSTComponents(purchaseCostPerUnit, gstRate);

  const adAlloc = adAllocationMap.get(order.id) ?? null;
  const result = calculateOrderProfit(
    order,
    skuCost,
    gstSettings,
    rtoSettings,
    adAlloc,
  );

  const totalInputGST =
    perUnit.inputGST !== null && !isNaN(order.quantity ?? 0)
      ? (order.quantity ?? 1) * perUnit.inputGST
      : null;

  const taxableCOGS =
    perUnit.taxableCost !== null && !isNaN(order.quantity ?? 0)
      ? (order.quantity ?? 1) * perUnit.taxableCost
      : null;

  const estimatedAccountingProfit = result.gstAdjustedProfit ?? null;
  const profitPercent = calculateProfitPercent(
    result.netCashProfit,
    result.purchaseCostInclGST,
  );

  return {
    ...order,
    purchaseCostPerUnit,
    actualPurchaseAmountPaid: result.purchaseCostInclGST,
    taxableCostPerUnit: perUnit.taxableCost,
    inputGSTPerUnit: perUnit.inputGST,
    totalInputGST,
    taxableCOGS,
    basicCashProfit: result.cashProfitBeforeAds,
    cashProfitBeforeAds: result.cashProfitBeforeAds,
    estimatedAccountingProfit,
    estimatedAdAllocation: result.allocatedAdCost,
    netProfit: result.netCashProfit,
    profitPercent,
    marginPercent: result.margin,
    hasMissingCost,
    rowStatus: result.calculationStatus,
    warnings: result.warnings,
    outputGST: result.outputGST,
    outputGSTEstimated: result.outputGSTEstimated,
    netGSTPayable: result.netGSTPayable,
    gstAdjustedProfit: result.gstAdjustedProfit,
  };
}

export function enrichAllOrders(
  orders: Order[],
  skuCosts: SKUCost[],
  gstSettings: GSTSettings,
  rtoSettings: RTOSettings,
  adsEntries: AdsCostEntry[],
  adMethod: AdAllocationMethod,
): OrderWithCalculations[] {
  const skuCostMap = new Map(skuCosts.map((s) => [s.supplierSKU, s]));
  const adAllocMap = calculateAdAllocation(orders, adsEntries, adMethod);
  return orders.map((o) =>
    enrichOrderWithCalculations(o, skuCostMap, gstSettings, rtoSettings, adAllocMap),
  );
}

export function aggregateBySKU(
  enrichedOrders: OrderWithCalculations[],
): SKUAggregate[] {
  const map = new Map<string, SKUAggregate>();

  for (const order of enrichedOrders) {
    const sku = order.supplierSKU;
    if (!map.has(sku)) {
      map.set(sku, {
        supplierSKU: sku,
        productName: order.productName || sku,
        units: 0,
        unitsSold: 0,
        sales: 0,
        settlement: 0,
        purchaseCost: 0,
        cogs: 0,
        inputGST: 0,
        adCost: 0,
        profit: 0,
        profitPerUnit: null,
        margin: null,
        roi: null,
        rtoCount: 0,
        returnCount: 0,
        cancellationCount: 0,
        hasMissingCost: false,
      });
    }
    const agg = map.get(sku)!;
    agg.units += order.quantity ?? 0;
    if (
      order.liveOrderStatus === "Delivered" ||
      order.liveOrderStatus === "Shipped"
    ) {
      agg.unitsSold += order.quantity ?? 0;
    }
    agg.sales += order.totalSaleAmount ?? 0;
    agg.settlement += order.finalSettlementAmount ?? 0;
    if (order.actualPurchaseAmountPaid !== null) {
      agg.purchaseCost! += order.actualPurchaseAmountPaid;
    } else {
      agg.hasMissingCost = true;
    }
    if (order.taxableCOGS !== null) agg.cogs! += order.taxableCOGS;
    if (order.totalInputGST !== null) agg.inputGST! += order.totalInputGST;
    if (order.estimatedAdAllocation !== null)
      agg.adCost! += order.estimatedAdAllocation;
    if (order.basicCashProfit !== null) {
      agg.profit! += order.basicCashProfit;
    } else {
      agg.hasMissingCost = true;
    }
    if (order.hasMissingCost) agg.hasMissingCost = true;
    if (order.liveOrderStatus === "RTO") agg.rtoCount += 1;
    if (order.liveOrderStatus === "Returned") agg.returnCount += 1;
    if (order.liveOrderStatus === "Cancelled") agg.cancellationCount += 1;
  }

  const result = Array.from(map.values());
  for (const agg of result) {
    if (agg.hasMissingCost) {
      agg.purchaseCost = agg.purchaseCost || null;
      agg.cogs = agg.cogs || null;
      agg.inputGST = agg.inputGST || null;
      agg.adCost = agg.adCost || null;
      agg.profit = agg.profit || null;
      agg.margin = null;
      agg.roi = null;
      agg.profitPerUnit = null;
    } else {
      agg.margin = calculateMarginPercent(agg.profit ?? null, agg.settlement);
      agg.roi = calculateProfitPercent(agg.profit ?? null, agg.cogs ?? null);
      agg.profitPerUnit =
        agg.unitsSold > 0 && agg.profit !== null
          ? agg.profit / agg.unitsSold
          : null;
    }
  }
  return result;
}

export function aggregateByMonth(
  enrichedOrders: OrderWithCalculations[],
  adsEntries: AdsCostEntry[],
): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();

  for (const order of enrichedOrders) {
    const mk = getMonthKey(order.orderDate);
    if (!map.has(mk)) {
      map.set(mk, {
        monthKey: mk,
        monthLabel: order.orderDate
          ? formatMonthYear(order.orderDate)
          : "Unknown",
        orders: 0,
        units: 0,
        sales: 0,
        settlement: 0,
        purchaseCost: 0,
        cogs: 0,
        adSpend: 0,
        profit: 0,
        margin: null,
        returns: 0,
        rto: 0,
        cancellations: 0,
      });
    }
    const agg = map.get(mk)!;
    agg.orders += 1;
    agg.units += order.quantity ?? 0;
    agg.sales += order.totalSaleAmount ?? 0;
    agg.settlement += order.finalSettlementAmount ?? 0;
    if (order.actualPurchaseAmountPaid !== null)
      agg.purchaseCost! += order.actualPurchaseAmountPaid;
    if (order.taxableCOGS !== null) agg.cogs! += order.taxableCOGS;
    if (order.basicCashProfit !== null) agg.profit! += order.basicCashProfit;
    if (order.liveOrderStatus === "Returned") agg.returns += 1;
    if (order.liveOrderStatus === "RTO") agg.rto += 1;
    if (order.liveOrderStatus === "Cancelled") agg.cancellations += 1;
  }

  const adsByMonth = new Map<string, number>();
  for (const ad of adsEntries) {
    const mk = getMonthKey(ad.deductionDate);
    const cost = ad.totalAdsCost ?? ad.adCost ?? 0;
    adsByMonth.set(mk, (adsByMonth.get(mk) ?? 0) + cost);
  }

  for (const [mk, agg] of map.entries()) {
    agg.adSpend = adsByMonth.get(mk) ?? 0;
    agg.margin = calculateMarginPercent(agg.profit ?? null, agg.settlement);
    if (agg.purchaseCost === 0) agg.purchaseCost = null;
    if (agg.cogs === 0) agg.cogs = null;
    if (agg.profit === 0 && agg.settlement === 0) agg.profit = null;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
}

export function classifyStatus(rawStatus: string): OrderStatus {
  if (!rawStatus) return "Other";
  const s = rawStatus.toString().toLowerCase().trim();
  if (s.includes("cancel")) return "Cancelled";
  if (s.includes("return")) return "Returned";
  if (s.includes("rto")) return "RTO";
  if (s.includes("deliver")) return "Delivered";
  if (s.includes("ship") || s.includes("dispatch")) return "Shipped";
  if (s.includes("pending")) return "Pending";
  return "Other";
}
