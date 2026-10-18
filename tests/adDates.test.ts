import { describe, it, expect } from "vitest";
import { getAdMonthKey } from "@/lib/adDates";
import { aggregateByMonth, enrichAllOrders } from "@/calculations";
import { parseAdsSheet } from "@/services/excelParser";
import * as XLSX from "xlsx";
import type { AdsCostEntry } from "@/types";
const ad = (deductionDuration?: string, deductionDate: Date | null = null): AdsCostEntry => ({id: "ad", deductionDuration, deductionDate, adCost: 74962, totalAdsCost: 74962, rawFields: {}, importedAt: ""});
describe("advertising reporting months", () => {
  it.each(["2026-10", "October 2026", "01/10/2026 to 31/10/2026", "2026-10-01 - 2026-10-31", "01 Oct 2026 to 31 Oct 2026"])("resolves an unambiguous period: %s", period => {
    expect(getAdMonthKey(ad(period))).toBe("2026-10");
    expect(aggregateByMonth([], [ad(period)])[0].monthLabel).toBe("October 2026");
  });
  it.each([undefined, "", "30/09/2026 to 01/10/2026", "2026-09 - 2026-10", "31/02/2026", "31 Feb 2026", "September to October 2026", "31/10/2026 to 01/11"])("keeps unresolved or multi-month period separate: %s", period => {
    expect(getAdMonthKey(ad(period))).toBe("unknown");
    expect(aggregateByMonth([], [ad(period)])).toEqual([]);
  });
  it("uses the actual deduction date in preference to a period", () => expect(getAdMonthKey(ad("September 2026", new Date(2026, 9, 15)))).toBe("2026-10"));
  it("does not append unknown to the months used for comparisons", () => {
    const result = aggregateByMonth([], [ad(undefined, new Date(2026, 8, 1)), ad(undefined, new Date(2026, 9, 1)), ad()]);
    expect(result.map(row => row.monthKey)).toEqual(["2026-09", "2026-10"]);
  });
  it("does not allocate undated ads to undated orders", () => {
    const result = enrichAllOrders([{id:"1",subOrderNo:"1",supplierSKU:"A",productName:"Item",orderDate:null,liveOrderStatus:"Delivered",rawStatus:"",quantity:1,finalSettlementAmount:100,meeshoFees:{},rawFields:{},importedAt:""}], [{supplierSKU:"A",purchaseCostInclGST:50,gstRate:0,createdAt:"",updatedAt:""}], {gstRegistered:false,purchaseGSTRate:0,sellingGSTRate:0,itcEligible:false}, {rtoShippingCost:0,chargeProductCostOnRTO:false}, {returnProductCondition:"usable"}, {}, [ad()], "equal");
    expect(result[0].estimatedAdAllocation).toBe(0);
  });
  it("detects an ads header below report preamble rows", () => {
    const warnings: string[] = [];
    const rows = parseAdsSheet(XLSX.utils.aoa_to_sheet([["Advertising report"], [], ["Deduction Duration", "Total Ads Cost"], ["October 2026", 74962]]), warnings);
    expect(rows).toHaveLength(1); expect(getAdMonthKey(rows[0])).toBe("2026-10"); expect(rows[0].totalAdsCost).toBe(74962);
  });
});
