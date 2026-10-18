import { describe, it, expect } from "vitest";
import { calculateOrderProfit, enrichAllOrders, aggregateBySKU, aggregateByMonth, calculateAdAllocation, classifyStatus } from "@/calculations";
import { mergeEntries, mergeOrders, reviewOrders, parseBackup } from "@/services/dataIntegrity";
import type { Order, SKUCost, AdsCostEntry, AppData } from "@/types";
const gst = { gstRegistered: true, purchaseGSTRate: 18, sellingGSTRate: 18, itcEligible: true };
const rto = { rtoShippingCost: 0, chargeProductCostOnRTO: false };
const returns = { returnProductCondition: "usable" as const };
const cost: SKUCost = { supplierSKU: "ABC", purchaseCostInclGST: 118, gstRate: 18, createdAt: "", updatedAt: "" };
const order = (changes: Partial<Order> = {}): Order => ({ id: "1", subOrderNo: "1", supplierSKU: "ABC", productName: "Item", rawStatus: "Delivered", importedAt: "", rawFields: {}, quantity: 1, liveOrderStatus: "Delivered", finalSettlementAmount: 200, orderDate: new Date(2026, 0, 10), meeshoFees: {}, ...changes });
const ad = (changes: Partial<AdsCostEntry> = {}): AdsCostEntry => ({ id: "ad1", deductionDate: new Date(2026, 0, 10), adCost: 20, totalAdsCost: 20, rawFields: {}, importedAt: "", ...changes });
const enrich = (orders: Order[], ads: AdsCostEntry[] = []) => enrichAllOrders(orders, [cost], gst, rto, returns, {}, ads, "equal");
describe("profit calculations", () => {
  it("calculates purchase tax, cash and attributed net profit", () => {
    const result = calculateOrderProfit(order(), cost, gst, rto, returns, undefined, 20);
    expect(result.inputGST).toBeCloseTo(18); expect(result.cashProfitBeforeAds).toBe(82); expect(result.netCashProfit).toBe(62);
  });
  it.each(["Returned", "RTO"] as const)("uses zero returned inventory cost consistently for %s", status => {
    const result = enrich([order({ liveOrderStatus: status, finalSettlementAmount: -20 })])[0];
    expect(result.actualPurchaseAmountPaid).toBe(0); expect(result.totalInputGST).toBe(0); expect(result.taxableCOGS).toBe(0);
  });
  it("charges damaged inventory", () => {
    const result = calculateOrderProfit(order({ liveOrderStatus: "Returned" }), cost, gst, rto, returns, "damaged", 0);
    expect(result.purchaseCostInclGST).toBe(118);
  });
  it("matches normalized SKU costs", () => expect(enrich([order({supplierSKU: " abc "})])[0].netProfit).toBe(82));
  it("does not fabricate profit when a cost is missing", () => expect(enrich([order({supplierSKU: "unknown"})])[0].netProfit).toBeNull());
  it("does not assign negative advertising costs", () => {
    const result = calculateAdAllocation([order(), order({ id: "2", finalSettlementAmount: -20 })], [ad({ totalAdsCost: 80 })], "byOrderValue");
    expect(result.get("1")).toBe(80); expect(result.get("2")).toBe(0);
  });
  it("allocates advertising within its month", () => {
    const result = enrich([order(), order({id: "2", orderDate: new Date(2026, 1, 10)})], [ad()]);
    expect(result[0].estimatedAdAllocation).toBe(20); expect(result[1].estimatedAdAllocation).toBe(0);
  });
  it("SKU totals agree with attributed order profits", () => {
    const rows = enrich([order()], [ad()]); expect(aggregateBySKU(rows)[0].profit).toBe(rows[0].netProfit);
  });
  it("monthly totals deduct actual spend even without attribution", () => {
    const rows = enrichAllOrders([order()], [cost], gst, rto, returns, {}, [ad()], "none");
    expect(aggregateByMonth(rows, [ad()])[0].profit).toBe(62);
  });
  it("keeps months with ads and no orders", () => expect(aggregateByMonth([], [ad()])[0].profit).toBe(-20));
  it.each(["RTO", "Return to Origin", "return-to-origin"])("recognizes %s", status => expect(classifyStatus(status)).toBe("RTO"));
});
describe("imports and backups", () => {
  it("updates existing orders without duplicating them", () => {
    const existing = order(); const incoming = order({liveOrderStatus: "Returned", finalSettlementAmount: -20});
    expect(mergeOrders([existing], [incoming])).toEqual([incoming]);
    expect(reviewOrders([existing], [incoming])).toEqual({added: 0, updated: 1, duplicates: 0});
  });
  it("deduplicates payments across repeated imports", () => {
    const first = ad(); const second = ad({id: "new-id", importedAt: "later"});
    expect(mergeEntries([first], [second])).toHaveLength(1);
    expect(mergeEntries([first], [ad({totalAdsCost: 50})])).toHaveLength(2);
  });
  const backup = (): AppData => ({ orders: [order()], ads: [ad()], referrals: [], compensations: [], skuCosts: [cost], gstSettings: gst, userSettings: { currency: "INR", adAllocationMethod: "equal", defaultProfitView: "cash", decimalPlaces: 2, rto, returnOrder: returns } });
  it("restores real dates and can sort restored orders", () => {
    const restored = parseBackup(JSON.stringify(backup()));
    expect(restored.orders[0].orderDate).toBeInstanceOf(Date); expect(restored.ads[0].deductionDate).toBeInstanceOf(Date);
    expect(restored.orders[0].orderDate?.getTime()).toBe(order().orderDate?.getTime());
  });
  it("rejects malformed backups before storage writes", () => {
    expect(() => parseBackup("{}" )).toThrow();
    expect(() => parseBackup(JSON.stringify({...backup(), orders: [{...order(), orderDate: "invalid"}]}))).toThrow();
    expect(() => parseBackup(JSON.stringify({...backup(), version: 99}))).toThrow();
  });
});
