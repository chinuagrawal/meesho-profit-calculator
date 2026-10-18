import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseOrderPaymentsSheet } from "@/services/excelParser";
function parse(rows: unknown[][]) {
  const warnings: string[] = [], errors: string[] = [];
  const orders = parseOrderPaymentsSheet(XLSX.utils.aoa_to_sheet(rows), warnings, errors);
  return { orders, warnings, errors };
}
const headers = ["Sub Order No", "Supplier SKU", "Quantity", "Final Settlement Amount", "Order Date", "Actual GST Amount"];
describe("spreadsheet imports", () => {
  it("reads Indian date strings and actual GST", () => {
    const result = parse([headers, ["1", " ABC ", 2, 200, "15/10/2026", 18]]);
    expect(result.errors).toHaveLength(0); expect(result.orders[0].orderDate?.getDate()).toBe(15);
    expect(result.orders[0].supplierSKU).toBe("ABC"); expect(result.orders[0].actualGSTAmount).toBe(18);
  });
  it("rejects incomplete rows and invalid quantities with row numbers", () => {
    const result = parse([headers, ["1", "ABC", 0, 200], ["2", "ABC", 1, ""], ["3", "ABC", 1.5, 200]]);
    expect(result.orders).toHaveLength(0); expect(result.warnings).toHaveLength(3); expect(result.warnings[0]).toContain("Row 2 rejected");
  });
  it("blocks sheets missing required columns", () => {
    const result = parse([["Supplier SKU", "Quantity"], ["ABC", 1]]);
    expect(result.orders).toHaveLength(0); expect(result.errors.length).toBeGreaterThan(0);
  });
  it("retains valid rows alongside rejected rows", () => {
    const result = parse([headers, ["1", "ABC", 1, -25], ["2", "", 1, 30]]);
    expect(result.orders).toHaveLength(1); expect(result.orders[0].finalSettlementAmount).toBe(-25); expect(result.warnings).toHaveLength(1);
  });
});
