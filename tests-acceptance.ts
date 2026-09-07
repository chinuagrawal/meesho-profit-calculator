import { calculateOrderProfit, calculatePurchaseGSTComponents } from "./src/calculations/index";
import type { Order, SKUCost, GSTSettings, RTOSettings } from "./src/types/index";

let passed = 0;
let failed = 0;
const results: string[] = [];

function assert(
  testName: string,
  actual: number | string | null | undefined | boolean,
  expected: number | string | null | undefined | boolean,
  tolerance = 0.01,
) {
  let ok: boolean;
  if (typeof actual === "number" && typeof expected === "number") {
    ok = Math.abs(actual - expected) <= tolerance;
  } else {
    ok = actual === expected;
  }
  if (ok) {
    passed++;
    results.push(`  ✓ ${testName}`);
  } else {
    failed++;
    results.push(
      `  ✗ ${testName}\n      Expected: ${JSON.stringify(expected)}\n      Actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function section(title: string) {
  results.push(`\n${title}`);
}

const baseGST: GSTSettings = {
  gstRegistered: true,
  purchaseGSTRate: 18,
  sellingGSTRate: 18,
  itcEligible: true,
};

const baseRTO: RTOSettings = {
  rtoShippingCost: 0,
  chargeProductCostOnRTO: true,
};

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: "test",
    subOrderNo: "TEST-1",
    orderDate: new Date("2024-01-01"),
    liveOrderStatus: "Delivered",
    supplierSKU: "TEST-SKU",
    productName: "Test Product",
    quantity: 1,
    sellingPricePerUnit: null,
    finalSettlementAmount: 0,
    actualGSTAmount: null,
    adsCost: null,
    tds: null,
    orderValue: null,
    ...partial,
  };
}

function makeSKUCost(partial: Partial<SKUCost>): SKUCost {
  return {
    supplierSKU: "TEST-SKU",
    productName: "Test",
    purchaseCostInclGST: null,
    gstRate: null,
    purchaseCostExclGST: null,
    inputGST: null,
    lastUpdated: new Date(),
    ...partial,
  };
}

// ===== TEST 1 — Normal Delivered Order =====
section("TEST 1 — Normal Delivered Order");
{
  const order = makeOrder({
    finalSettlementAmount: 46.37,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Cash Profit = ₹10.97", r.cashProfitBeforeAds, 10.97);
  assert("Net Cash Profit = ₹10.97", r.netCashProfit, 10.97);
  assert("Calculation Status = PROFIT", r.calculationStatus, "PROFIT");
  assert("Quantity = 1", r.quantity, 1);
}

// ===== TEST 2 — GST Purchase Split =====
section("TEST 2 — GST Purchase Split");
{
  const comps = calculatePurchaseGSTComponents(35.4, 18);
  assert("Purchase excl GST = ₹30.00", comps.taxableCost, 30);
  assert("Input GST = ₹5.40", comps.inputGST, 5.4);
  const order = makeOrder({
    finalSettlementAmount: 46.37,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  // Cash profit uses inclusive cost (NOT exclusive)
  assert("Cash profit uses full purchase incl GST = ₹10.97", r.cashProfitBeforeAds, 10.97);
  assert(
    "Purchase Cost Incl GST field = ₹35.40",
    r.purchaseCostInclGST,
    35.4,
  );
  assert("Input GST field = ₹5.40", r.inputGST, 5.4);
  assert("Purchase Cost Excl GST field = ₹30.00", r.purchaseCostExclGST, 30);
}

// ===== TEST 3 — RTO (configurable) =====
section("TEST 3 — RTO with Charge Product Cost = ON");
{
  const order = makeOrder({
    finalSettlementAmount: 0,
    liveOrderStatus: "RTO",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Profit = -₹35.40 (charge ON)", r.netCashProfit, -35.4);
  assert("Calculation Status = RTO", r.calculationStatus, "RTO");
}

section("TEST 3 — RTO with Charge Product Cost = OFF");
{
  const order = makeOrder({
    finalSettlementAmount: 0,
    liveOrderStatus: "RTO",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const rtoOff: RTOSettings = {
    rtoShippingCost: 0,
    chargeProductCostOnRTO: false,
  };
  const r = calculateOrderProfit(order, skuCost, baseGST, rtoOff, 0);
  assert("Profit = ₹0 (charge OFF)", r.netCashProfit, 0);
  assert("Purchase Cost Incl GST = 0 (charge OFF)", r.purchaseCostInclGST, 0);
  assert("Input GST = 0 (charge OFF)", r.inputGST, 0);
}

// ===== TEST 4 — Cancelled Order with Settlement =====
section("TEST 4 — Cancelled Order with Settlement");
{
  const order = makeOrder({
    finalSettlementAmount: 52.11,
    liveOrderStatus: "Cancelled",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert(
    "Calculation Status = REVIEW_REQUIRED",
    r.calculationStatus,
    "REVIEW_REQUIRED",
  );
  assert(
    "Warning includes 'Cancelled order has settlement'",
    r.warnings.some((w) => w.toLowerCase().includes("cancelled") && w.toLowerCase().includes("settlement")),
    true,
  );
}

section("TEST 4 — Cancelled Order WITHOUT Settlement");
{
  const order = makeOrder({
    finalSettlementAmount: 0,
    liveOrderStatus: "Cancelled",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Status = CANCELLED", r.calculationStatus, "CANCELLED");
}

// ===== TEST 5 — Negative Settlement =====
section("TEST 5 — Negative Settlement");
{
  const order = makeOrder({
    finalSettlementAmount: -157,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 23.6, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Profit = -₹180.60", r.netCashProfit, -180.6);
  assert("Margin = — (null)", r.margin, null);
  assert("Status = LOSS", r.calculationStatus, "LOSS");
}

// ===== TEST 6 — Missing SKU Cost =====
section("TEST 6 — Missing SKU Cost");
{
  const order = makeOrder({
    finalSettlementAmount: 100,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: null, gstRate: null });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Net Profit = null (—)", r.netCashProfit, null);
  assert("Status = COST_MISSING", r.calculationStatus, "COST_MISSING");
  assert(
    "Purchase Cost Incl GST remains null (not ₹0)",
    r.purchaseCostInclGST,
    null,
  );
}

// ===== TEST 7 — Quantity 2 =====
section("TEST 7 — Quantity 2");
{
  const order = makeOrder({
    finalSettlementAmount: 100,
    quantity: 2,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 35.4, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 0);
  assert("Total Purchase Cost = ₹70.80", r.purchaseCostInclGST, 70.8);
  assert("Cash Profit = ₹29.20", r.cashProfitBeforeAds, 29.2);
  assert("Net Cash Profit = ₹29.20", r.netCashProfit, 29.2);
}

// ===== TEST 8 — No Double Counting =====
section("TEST 8 — No Double Counting");
{
  // Settlement = 100 (already after commission/shipping/fees deductions)
  // Purchase = 50, Ad = 10. Profit must be 40 (=100-50-10), not subtracting anything else.
  const order = makeOrder({
    finalSettlementAmount: 100,
    liveOrderStatus: "Delivered",
  });
  const skuCost = makeSKUCost({ purchaseCostInclGST: 50, gstRate: 18 });
  const r = calculateOrderProfit(order, skuCost, baseGST, baseRTO, 10);
  assert(
    "Net Cash Profit = 100 − 50 − 10 = 40 (no double deductions)",
    r.netCashProfit,
    40,
  );
  assert("Settlement = 100 (preserved)", r.settlement, 100);
  assert("allocatedAdCost = 10", r.allocatedAdCost, 10);
}

// ===== Summary =====
console.log("=".repeat(60));
console.log("MEESHO PROFIT CALCULATOR — ACCEPTANCE TESTS (Section 25)");
console.log("=".repeat(60));
results.forEach((l) => console.log(l));
console.log("=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
