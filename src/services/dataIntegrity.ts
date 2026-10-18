import type { AppData, Order } from "@/types";

function stable(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value.map(stable));
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).filter(([k]) => k !== "id" && k !== "importedAt").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return JSON.stringify(value);
}
export function mergeEntries<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map(row => [stable(row), row]));
  incoming.forEach(row => map.set(stable(row), map.get(stable(row)) ?? row));
  return [...map.values()];
}
export function mergeOrders(existing: Order[], incoming: Order[]): Order[] {
  const map = new Map(existing.map(row => [row.subOrderNo.trim() || row.id, row]));
  incoming.forEach(row => map.set(row.subOrderNo.trim() || row.id, row));
  return [...map.values()];
}
export function reviewOrders(existing: Order[], incoming: Order[]) {
  const map = new Map(existing.map(row => [row.subOrderNo.trim() || row.id, row]));
  const review = { added: 0, updated: 0, duplicates: 0 };
  incoming.forEach(row => {
    const key = row.subOrderNo.trim() || row.id;
    const previous = map.get(key);
    if (!previous) review.added++;
    else if (stable(previous) === stable(row)) review.duplicates++;
    else review.updated++;
    map.set(key, row);
  });
  return review;
}
export function parseBackup(json: string): AppData {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object" || data.version !== undefined && data.version !== 1) throw new Error("Unsupported backup format");
  for (const key of ["orders", "ads", "referrals", "compensations", "skuCosts"]) {
    if (!Array.isArray(data[key])) throw new Error(`Backup is missing ${key}`);
    const ids = new Set<string>();
    data[key].forEach((row: Record<string, unknown>) => {
      if (!row || typeof row !== "object") throw new Error(`Invalid ${key} entry`);
      const id = key === "skuCosts" ? row.supplierSKU : row.id;
      if (typeof id !== "string" || !id || ids.has(id)) throw new Error(`Invalid or duplicate identifier in ${key}`);
      ids.add(id);
      for (const [field, value] of Object.entries(row)) {
        if (/Date$/.test(field) || field === "date") {
          if (value === null || value === undefined) continue;
          const date = new Date(value as string);
          if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${field}`);
          row[field] = date;
        }
        if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Invalid ${field}`);
      }
      const moneyFields = ["finalSettlementAmount", "listingPrice", "totalSaleAmount", "totalSaleReturnAmount", "productGSTPercent", "actualGSTAmount", "adCost", "totalAdsCost", "amount", "compensationAmount", "recoveryAmount", "purchaseCostInclGST", "gstRate"];
      for (const field of moneyFields) if (row[field] !== undefined && row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field]))) throw new Error(`Invalid ${field}`);
      if (key === "skuCosts" && (typeof row.gstRate !== "number" || (row.gstRate as number) < 0 || (row.gstRate as number) > 100 || row.purchaseCostInclGST !== null && (typeof row.purchaseCostInclGST !== "number" || (row.purchaseCostInclGST as number) < 0))) throw new Error("Invalid SKU cost");
      if (key === "orders") {
        if (typeof row.productName !== "string" || typeof row.rawStatus !== "string" || row.finalSettlementAmount === undefined || !Number.isInteger(row.quantity)) throw new Error("Invalid order fields");
        if (typeof row.meeshoFees !== "object" || row.meeshoFees === null || Array.isArray(row.meeshoFees) || Object.values(row.meeshoFees).some(v => v !== null && (typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Invalid order fees");
      }
      if (key === "orders" && (typeof row.supplierSKU !== "string" || typeof row.subOrderNo !== "string" || !row.meeshoFees || typeof row.quantity !== "number" || row.quantity <= 0 || !["Delivered", "Shipped", "Returned", "RTO", "Cancelled", "Pending", "Other"].includes(String(row.liveOrderStatus)))) throw new Error("Invalid order in backup");
    });
  }
  if (!data.gstSettings || !data.userSettings || typeof data.gstSettings.gstRegistered !== "boolean" || typeof data.gstSettings.itcEligible !== "boolean" || !["none", "equal", "byOrderValue", "byQuantity"].includes(data.userSettings.adAllocationMethod)) throw new Error("Invalid backup settings");
  for (const rate of [data.gstSettings.purchaseGSTRate, data.gstSettings.sellingGSTRate]) if (typeof rate !== "number" || rate < 0 || rate > 100) throw new Error("Invalid GST rate");
  if (data.returnOverrides && Object.values(data.returnOverrides).some(value => value !== "usable" && value !== "damaged")) throw new Error("Invalid return override");
  const settings = data.userSettings;
  if (typeof settings.currency !== "string" || !["cash", "accounting", "net"].includes(settings.defaultProfitView) || !Number.isInteger(settings.decimalPlaces) || settings.decimalPlaces < 0 || settings.decimalPlaces > 6) throw new Error("Invalid display settings");
  if (settings.rto && (typeof settings.rto.chargeProductCostOnRTO !== "boolean" || typeof settings.rto.rtoShippingCost !== "number" || settings.rto.rtoShippingCost < 0)) throw new Error("Invalid RTO settings");
  if (settings.returnOrder && !["usable", "damaged", "manual"].includes(settings.returnOrder.returnProductCondition)) throw new Error("Invalid return settings");
  return data;
}
