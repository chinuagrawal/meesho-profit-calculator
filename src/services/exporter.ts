import * as XLSX from "xlsx";
import type {
  OrderWithCalculations,
  SKUAggregate,
  AdsCostEntry,
  ReferralPayment,
  CompensationEntry,
  SKUCost,
  GSTSettings,
  UserSettings,
  CalculationStatus,
} from "@/types";
import { aggregateBySKU } from "@/calculations";
import { formatDateISO, calculationStatusLabel } from "@/lib/utils";

function fmt(n: number | null | undefined): number | string {
  if (n === null || n === undefined || isNaN(n as number)) return "";
  return Math.round((n as number) * 100) / 100;
}

function orderDate(d: Date | null | undefined): string {
  if (!d) return "";
  return formatDateISO(d);
}

function buildProfitReportRows(orders: OrderWithCalculations[]) {
  return orders.map((o) => ({
    "Order Date": orderDate(o.orderDate),
    "Sub Order No": o.subOrderNo,
    "Product Name": o.productName || "",
    "Supplier SKU": o.supplierSKU,
    Quantity: o.quantity,
    "Live Order Status": o.liveOrderStatus,
    "Settlement Amount": fmt(o.finalSettlementAmount),
    "Purchase Cost Incl GST": fmt(o.actualPurchaseAmountPaid),
    "Purchase Cost Excl GST": fmt(o.taxableCOGS),
    "Input GST": fmt(o.totalInputGST),
    "Output GST": fmt(o.outputGST),
    "Cash Profit Before Ads": fmt(o.cashProfitBeforeAds),
    "Allocated Ad Cost": fmt(o.estimatedAdAllocation),
    "Net Cash Profit": fmt(o.netProfit),
    "Margin %": fmt(o.marginPercent),
    "Calculation Status": calculationStatusLabel(o.rowStatus),
    Warnings: o.warnings?.join("; ") || "",
  }));
}

function buildOrderDetailsRows(orders: OrderWithCalculations[]) {
  return orders.map((o) => ({
    "Order Date": orderDate(o.orderDate),
    "Sub Order No": o.subOrderNo,
    "Product Name": o.productName || "",
    "Supplier SKU": o.supplierSKU,
    Quantity: o.quantity,
    "Live Order Status": o.liveOrderStatus,
    "Order Value": fmt(o.orderValue),
    "Selling Price / Unit": fmt(o.sellingPricePerUnit),
    "Settlement Amount": fmt(o.finalSettlementAmount),
    "Actual GST (from report)": fmt(o.actualGSTAmount),
    "Est. Output GST": fmt(o.outputGST),
    "Purchase Cost Incl GST": fmt(o.actualPurchaseAmountPaid),
    "Purchase Cost Excl GST": fmt(o.taxableCOGS),
    "Input GST": fmt(o.totalInputGST),
    "Cash Profit Before Ads": fmt(o.cashProfitBeforeAds),
    "Ad Cost (Allocated)": fmt(o.estimatedAdAllocation),
    "Net Cash Profit": fmt(o.netProfit),
    "GST Adjusted Profit": fmt(o.gstAdjustedProfit),
    "Net GST Payable (Est.)": fmt(o.netGSTPayable),
    "Margin %": fmt(o.marginPercent),
    "Calculation Status": calculationStatusLabel(o.rowStatus),
    "Has Missing Cost": o.hasMissingCost ? "YES" : "NO",
    Warnings: o.warnings?.join("; ") || "",
  }));
}

function buildSKUAnalysisRows(skus: SKUAggregate[]) {
  return skus.map((s) => ({
    "Supplier SKU": s.supplierSKU,
    "Product Name": s.productName,
    "Orders Count": s.orders,
    "Units Sold": s.unitsSold ?? s.units,
    "Sales Amount": fmt(s.sales),
    "Settlement": fmt(s.settlement),
    "COGS (Excl GST)": fmt(s.cogs),
    "Input GST": fmt(s.inputGST),
    "Ad Cost": fmt(s.adCost),
    "Profit / Unit": fmt(s.profitPerUnit),
    "Total Profit": fmt(s.profit),
    "Margin %": fmt(s.margin),
    "ROI %": fmt(s.roi),
    "RTO Count": s.rtoCount ?? 0,
    "Return Count": s.returnCount ?? 0,
    "Cancellation Count": s.cancellationCount ?? 0,
    "Has Missing Cost": s.hasMissingCost ? "YES" : "NO",
  }));
}

function buildGSTSummaryRows(
  orders: OrderWithCalculations[],
  gstSettings: GSTSettings,
) {
  let purchaseInclGST = 0;
  let purchaseExclGST = 0;
  let inputGST = 0;
  let outputGSTActual = 0;
  let outputGSTEstimated = 0;
  let hasActual = false;

  for (const o of orders) {
    if (o.actualPurchaseAmountPaid !== null && o.actualPurchaseAmountPaid !== undefined) {
      purchaseInclGST += o.actualPurchaseAmountPaid;
    }
    if (o.taxableCOGS !== null && o.taxableCOGS !== undefined) {
      purchaseExclGST += o.taxableCOGS;
    }
    if (o.totalInputGST !== null && o.totalInputGST !== undefined) {
      inputGST += o.totalInputGST;
    }
    if (o.outputGST !== null && o.outputGST !== undefined) {
      if (o.outputGSTEstimated) {
        outputGSTEstimated += o.outputGST;
      } else {
        outputGSTActual += o.outputGST;
        hasActual = true;
      }
    }
  }

  const totalOutputGST = outputGSTActual + outputGSTEstimated;
  const eligibleInputGST = gstSettings.itcEligible ? inputGST : 0;
  const netPayable = totalOutputGST - eligibleInputGST;

  return [
    { Setting: "GST Registered?", Value: gstSettings.gstRegistered ? "Yes" : "No" },
    { Setting: "Default Purchase GST Rate", Value: `${gstSettings.purchaseGSTRate}%` },
    { Setting: "Default Selling GST Rate", Value: `${gstSettings.sellingGSTRate}%` },
    { Setting: "ITC Eligible?", Value: gstSettings.itcEligible ? "Yes" : "No" },
    { Setting: "", Value: "" },
    { Setting: "Purchase Amount (Incl GST)", Value: fmt(purchaseInclGST) },
    { Setting: "Taxable Purchase (Excl GST)", Value: fmt(purchaseExclGST) },
    { Setting: "Input GST (Purchase Side)", Value: fmt(inputGST) },
    { Setting: "", Value: "" },
    { Setting: "Output GST (Actual from Report)", Value: fmt(outputGSTActual) },
    { Setting: "Output GST (Estimated from Settings)", Value: fmt(outputGSTEstimated) },
    { Setting: "Total Output GST", Value: fmt(totalOutputGST) },
    { Setting: "", Value: "" },
    { Setting: "Eligible Input Tax Credit (ITC)", Value: fmt(eligibleInputGST) },
    { Setting: "Estimated Net GST Payable (Before Adjustments)", Value: fmt(netPayable) },
    { Setting: "Actual Output GST Present?", Value: hasActual ? "Yes — partially or fully actual" : "No — all estimated from settings" },
  ];
}

function buildAdSummaryRows(
  ads: AdsCostEntry[],
  orders: OrderWithCalculations[],
  userSettings: UserSettings,
) {
  const byCampaign = new Map<string, { spend: number; orders: number }>();
  let totalSpend = 0;
  for (const a of ads) {
    totalSpend += a.adsCost ?? 0;
    const key = a.campaignName || "Unspecified";
    const cur = byCampaign.get(key) ?? { spend: 0, orders: 0 };
    cur.spend += a.adsCost ?? 0;
    byCampaign.set(key, cur);
  }

  let totalAllocated = 0;
  for (const o of orders) {
    if (o.estimatedAdAllocation) totalAllocated += o.estimatedAdAllocation;
  }

  const rows: any[] = [
    {
      Column: "Ad Allocation Method",
      Value: String(userSettings.adAllocationMethod ?? "none"),
    },
    { Column: "Total Ad Spend (from report)", Value: fmt(totalSpend) },
    { Column: "Total Allocated to Orders", Value: fmt(totalAllocated) },
    { Column: "Unallocated Difference", Value: fmt(totalSpend - totalAllocated) },
    { Column: "", Value: "" },
    { Column: "Campaign Name", Value: "Total Spend" },
  ];

  for (const [name, data] of Array.from(byCampaign.entries()).sort(
    (a, b) => b[1].spend - a[1].spend,
  )) {
    rows.push({ Column: name, Value: fmt(data.spend) });
  }

  return rows;
}

function buildMissingCostsRows(skuCosts: SKUCost[], orders: OrderWithCalculations[]) {
  const uniqueMissing = new Map<string, { sku: string; product: string; orderCount: number }>();

  for (const s of skuCosts) {
    if (
      s.purchaseCostInclGST === null ||
      s.purchaseCostInclGST === undefined
    ) {
      uniqueMissing.set(s.supplierSKU, {
        sku: s.supplierSKU,
        product: s.productName,
        orderCount: 0,
      });
    }
  }

  for (const o of orders) {
    if (o.hasMissingCost && uniqueMissing.has(o.supplierSKU)) {
      const cur = uniqueMissing.get(o.supplierSKU)!;
      cur.orderCount += 1;
      if (!cur.product && o.productName) cur.product = o.productName;
    }
  }

  const rows = Array.from(uniqueMissing.values());
  rows.sort((a, b) => b.orderCount - a.orderCount);

  return rows.map((r) => ({
    "Supplier SKU": r.sku,
    "Product Name": r.product || "",
    "Affected Order Count": r.orderCount,
    "Purchase Cost Incl GST": "",
    "GST Rate": "",
    Action: "Enter purchase cost including GST in SKU Costs page",
  }));
}

function buildValidationReportRows(
  orders: OrderWithCalculations[],
  skuCosts: SKUCost[],
) {
  const statusCounts = new Map<CalculationStatus, number>();
  for (const o of orders) {
    statusCounts.set(o.rowStatus, (statusCounts.get(o.rowStatus) ?? 0) + 1);
  }

  const negativeSettlement = orders.filter(
    (o) =>
      o.finalSettlementAmount !== null &&
      o.finalSettlementAmount !== undefined &&
      o.finalSettlementAmount < 0,
  ).length;
  const cancelledWithSettlement = orders.filter(
    (o) =>
      o.liveOrderStatus === "Cancelled" &&
      o.finalSettlementAmount !== null &&
      o.finalSettlementAmount !== undefined &&
      o.finalSettlementAmount > 0,
  ).length;
  const reviewRequired = orders.filter(
    (o) => o.rowStatus === "REVIEW_REQUIRED",
  ).length;
  const missingSKUs = skuCosts.filter(
    (s) =>
      s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
  ).length;
  const zeroSettlement = orders.filter(
    (o) => o.finalSettlementAmount === 0,
  ).length;
  const withWarnings = orders.filter(
    (o) => o.warnings && o.warnings.length > 0,
  ).length;

  const rows: any[] = [
    { Metric: "Total Orders Imported", Value: orders.length },
    { Metric: "Unique SKUs Identified", Value: skuCosts.length },
    { Metric: "", Value: "" },
    { Metric: "Calculation Status Breakdown", Value: "" },
  ];

  const allStatuses: CalculationStatus[] = [
    "PROFIT",
    "LOSS",
    "RTO",
    "CANCELLED",
    "COST_MISSING",
    "REVIEW_REQUIRED",
    "NO_SETTLEMENT",
    "INVALID_DATA",
  ];
  for (const s of allStatuses) {
    rows.push({
      Metric: `  · ${calculationStatusLabel(s)}`,
      Value: statusCounts.get(s) ?? 0,
    });
  }

  rows.push(
    { Metric: "", Value: "" },
    { Metric: "Quality / Data Checks", Value: "" },
    { Metric: "  · Missing SKU Costs (SKU count)", Value: missingSKUs },
    { Metric: "  · Negative Settlement Orders", Value: negativeSettlement },
    { Metric: "  · Cancelled Orders With Settlement", Value: cancelledWithSettlement },
    { Metric: "  · Orders Requiring Manual Review", Value: reviewRequired },
    { Metric: "  · Orders With Zero Settlement (incl. Cancelled/RTO)", Value: zeroSettlement },
    { Metric: "  · Orders With Warnings", Value: withWarnings },
  );

  // Warn about common issues
  const common: any[] = [];
  if (missingSKUs > 0) {
    common.push({ Warning: `${missingSKUs} SKU(s) missing purchase cost — profit not calculable for these orders` });
  }
  if (negativeSettlement > 0) {
    common.push({ Warning: `${negativeSettlement} order(s) have negative settlement (Meesho debits)` });
  }
  if (cancelledWithSettlement > 0) {
    common.push({ Warning: `${cancelledWithSettlement} cancelled order(s) still have settlement — verify manually` });
  }
  if (reviewRequired > 0) {
    common.push({ Warning: `${reviewRequired} order(s) flagged REVIEW REQUIRED` });
  }
  if (common.length === 0) {
    common.push({ Warning: "No obvious data-quality issues detected." });
  }

  rows.push({ Metric: "", Value: "" }, { Metric: "Data Quality Warnings", Value: "" });
  for (const c of common) {
    rows.push({ Metric: `  · ${c.Warning}`, Value: "" });
  }

  return rows;
}

export interface ExportInputs {
  orders: OrderWithCalculations[];
  skuCosts: SKUCost[];
  ads: AdsCostEntry[];
  referrals: ReferralPayment[];
  compensations: CompensationEntry[];
  gstSettings: GSTSettings;
  userSettings: UserSettings;
}

export function buildExportWorkbook(inputs: ExportInputs) {
  const {
    orders,
    skuCosts,
    ads,
    gstSettings,
    userSettings,
  } = inputs;

  const skuAggs: SKUAggregate[] = aggregateBySKU(orders);

  const ws1 = XLSX.utils.json_to_sheet(buildProfitReportRows(orders));
  const ws2 = XLSX.utils.json_to_sheet(buildOrderDetailsRows(orders));
  const ws3 = XLSX.utils.json_to_sheet(buildSKUAnalysisRows(skuAggs));
  const ws4 = XLSX.utils.json_to_sheet(buildGSTSummaryRows(orders, gstSettings));
  const ws5 = XLSX.utils.json_to_sheet(buildAdSummaryRows(ads, orders, userSettings));
  const ws6 = XLSX.utils.json_to_sheet(buildMissingCostsRows(skuCosts, orders));
  const ws7 = XLSX.utils.json_to_sheet(buildValidationReportRows(orders, skuCosts));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "1 Profit Report");
  XLSX.utils.book_append_sheet(wb, ws2, "2 Order Details");
  XLSX.utils.book_append_sheet(wb, ws3, "3 SKU Analysis");
  XLSX.utils.book_append_sheet(wb, ws4, "4 GST Summary");
  XLSX.utils.book_append_sheet(wb, ws5, "5 Ad Summary");
  XLSX.utils.book_append_sheet(wb, ws6, "6 Missing Costs");
  XLSX.utils.book_append_sheet(wb, ws7, "7 Validation Report");
  return wb;
}

function safeFilename(name: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..*/, "");
  return `${name}-${stamp}`;
}

export function downloadXLSX(inputs: ExportInputs) {
  const wb = buildExportWorkbook(inputs);
  XLSX.writeFile(wb, `${safeFilename("Meesho-Profit-Report")}.xlsx`);
}

export function downloadCSV(inputs: ExportInputs) {
  const rows = buildProfitReportRows(inputs.orders);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename("Meesho-Profit-Report")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
