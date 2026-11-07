import { describe, expect, it } from "vitest";
import { groupReturns, summarizeReturns } from "@/lib/returnAnalysis";
import { buildAdminReport } from "@/lib/adminReport";
import { accountFixture } from "./accountDataFixture";
import type { OrderStatus } from "@/types";

function orders(statuses: OrderStatus[]) {
  const base = buildAdminReport(accountFixture()).orders[0];
  return statuses.map((status, index) => ({ ...base, id: String(index), liveOrderStatus: status, netProfit: -10 }));
}

describe("return analysis", () => {
  it("includes RTO and customer returns, excludes cancellations from the denominator", () => {
    const result = summarizeReturns(orders(["Delivered", "Returned", "RTO", "Cancelled", "Pending", "Shipped"]));
    expect(result.eligible).toBe(5);
    expect(result.overallRate).toBe(40);
    expect(result.returnRate).toBe(20);
    expect(result.rtoRate).toBe(20);
    expect(result.netProfit).toBe(-20);
  });
  it("handles empty, cancelled-only, and all-returned selections", () => {
    expect(summarizeReturns([]).overallRate).toBeNull();
    expect(summarizeReturns(orders(["Cancelled"])).overallRate).toBeNull();
    expect(summarizeReturns(orders(["Returned", "RTO"])).overallRate).toBe(100);
  });
  it("keeps undated orders and missing profit visible in groups", () => {
    const rows = orders(["Returned", "Delivered", "RTO"]);
    rows[0].orderDate = null;
    rows[0].netProfit = null;
    rows[2].supplierSKU = "B";
    const months = groupReturns(rows, "month");
    expect(months.find(row => row.key === "unknown")).toMatchObject({ total: 1, missingProfit: 1, overallRate: 100 });
    const skus = groupReturns(rows, "sku");
    expect(skus.find(row => row.key === "A")).toMatchObject({ eligible: 2, overallRate: 50, missingProfit: 1 });
    expect(skus.find(row => row.key === "B")).toMatchObject({ eligible: 1, overallRate: 100 });
  });
});
