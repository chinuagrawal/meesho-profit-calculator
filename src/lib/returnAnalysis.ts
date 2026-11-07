import type { OrderWithCalculations } from "@/types";
import { getMonthKey } from "@/lib/utils";

export function summarizeReturns(orders: OrderWithCalculations[]) {
  const eligible = orders.filter(order => order.liveOrderStatus !== "Cancelled").length;
  const returned = orders.filter(order => order.liveOrderStatus === "Returned").length;
  const rto = orders.filter(order => order.liveOrderStatus === "RTO").length;
  const affected = orders.filter(order => order.liveOrderStatus === "Returned" || order.liveOrderStatus === "RTO");
  const rate = (count: number) => eligible ? count / eligible * 100 : null;
  return {
    eligible, returned, rto, total: returned + rto,
    overallRate: rate(returned + rto), returnRate: rate(returned), rtoRate: rate(rto),
    settlement: affected.reduce((sum, order) => sum + (order.finalSettlementAmount ?? 0), 0),
    missingSettlement: affected.filter(order => order.finalSettlementAmount == null).length,
    netProfit: affected.reduce((sum, order) => sum + (order.netProfit ?? 0), 0),
    missingProfit: affected.filter(order => order.netProfit == null).length,
  };
}

export function groupReturns(orders: OrderWithCalculations[], group: "month" | "sku") {
  const groups = new Map<string, OrderWithCalculations[]>();
  for (const order of orders) {
    const key = group === "month" ? getMonthKey(order.orderDate) : order.supplierSKU || "Unspecified SKU";
    const rows = groups.get(key) ?? [];
    rows.push(order);
    groups.set(key, rows);
  }
  return Array.from(groups, ([key, rows]) => ({ key, ...summarizeReturns(rows) }))
    .sort((a, b) => group === "month" ? a.key.localeCompare(b.key) : b.total - a.total || a.key.localeCompare(b.key));
}
