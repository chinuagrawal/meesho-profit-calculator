import { describe, expect, it } from "vitest";
import { buildAdminReport } from "@/lib/adminReport";
import { accountFixture } from "./accountDataFixture";

describe("read-only report calculations", () => {
  it("uses actual advertising even when order attribution is disabled", () => {
    const data = accountFixture();
    data.skuCosts = [{ supplierSKU: "A", purchaseCostInclGST: 118, gstRate: 18, createdAt: "", updatedAt: "" }];
    data.userSettings.adAllocationMethod = "none";
    data.ads = [{ id: "ad", deductionDate: data.orders[0].orderDate, adCost: 20, totalAdsCost: 20, importedAt: "", rawFields: {} }];
    const before = JSON.stringify(data);
    const report = buildAdminReport(data);
    expect(report.profit).toBeCloseTo(report.orders.reduce((sum, row) => sum + (row.basicCashProfit ?? 0), 0) - 20);
    expect(report.adSpend).toBe(20);
    expect(report.profit).toBe(62);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("flags missing profit instead of hiding incomplete records", () => {
    const data = accountFixture(); data.skuCosts = [];
    expect(buildAdminReport(data).missingProfit).toBeGreaterThan(0);
  });
});
