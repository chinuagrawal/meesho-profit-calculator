import * as XLSX from "xlsx";
import {
  Order,
  AdsCostEntry,
  ReferralPayment,
  CompensationEntry,
  ParsedWorkbook,
  ImportSummary,
  MeeshoFees,
  OrderStatus,
} from "@/types";
import { classifyStatus } from "@/calculations";
import { parseNumeric } from "@/lib/utils";

const HEADER_KEYWORDS = [
  "sub order no",
  "order date",
  "supplier sku",
  "quantity",
  "final settlement amount",
  "product name",
  "live order status",
  "listing price",
];

function normalize(s: string): string {
  return (
    s
      ?.toString()
      .toLowerCase()
      .replace(/[\s_\-().,/]/g, "") ?? ""
  );
}

function findHeaderRow(sheet: XLSX.WorkSheet): number {
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
  });
  const maxRows = Math.min(data.length, 10);
  let bestRow = -1;
  let bestScore = 0;
  for (let r = 0; r < maxRows; r++) {
    const row = data[r] || [];
    let score = 0;
    for (const cell of row) {
      const n = normalize(cell);
      for (const kw of HEADER_KEYWORDS) {
        if (normalize(kw) === n) score += 2;
        else if (n.includes(normalize(kw))) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestScore >= 2 ? bestRow : -1;
}

function buildColumnMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    if (h != null) {
      map.set(normalize(h), i);
    }
  });
  return map;
}

function getVal(row: any[], colMap: Map<string, number>, keys: string[]): any {
  for (const k of keys) {
    const idx = colMap.get(normalize(k));
    if (
      idx !== undefined &&
      row[idx] !== undefined &&
      row[idx] !== "" &&
      row[idx] !== null
    ) {
      return row[idx];
    }
  }
  return undefined;
}

function findSheet(workbook: XLSX.WorkBook, patterns: string[]): string | null {
  const names = workbook.SheetNames;
  for (const name of names) {
    const n = normalize(name);
    for (const p of patterns) {
      if (n.includes(normalize(p))) return name;
    }
  }
  return null;
}

function parseExcelDate(v: any): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseOrderPaymentsSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[],
  errors: string[],
): Order[] {
  const orders: Order[] = [];
  const headerRowIdx = findHeaderRow(sheet);
  if (headerRowIdx < 0) {
    errors.push(
      "Could not locate header row in Order Payments sheet (looking for fields like Sub Order No, Supplier SKU, Quantity, Final Settlement Amount)",
    );
    return orders;
  }

  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  const headers = (raw[headerRowIdx] || []).map((h: any) =>
    h == null ? "" : String(h),
  );
  const colMap = buildColumnMap(headers);

  const requiredFields = [
    "supplier sku",
    "quantity",
    "final settlement amount",
  ];
  const missingRequired = requiredFields.filter(
    (f) => !Array.from(colMap.keys()).some((k) => k.includes(normalize(f))),
  );
  if (missingRequired.length > 0) {
    errors.push(
      `Order Payments sheet is missing required columns: ${missingRequired.join(", ")}. Profit calculation may be incorrect.`,
    );
  }

  const now = new Date().toISOString();
  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row) continue;
    const isEmpty = row.every(
      (c: any) => c === "" || c === null || c === undefined,
    );
    if (isEmpty) continue;

    const subOrderNo = getVal(row, colMap, [
      "sub order no",
      "sub order",
      "order no",
      "order id",
      "order",
    ]);
    const supplierSKU = getVal(row, colMap, [
      "supplier sku",
      "sku",
      "supplier sku id",
    ]);
    const quantityVal = getVal(row, colMap, ["quantity", "qty"]);
    const finalSettlementVal = getVal(row, colMap, [
      "final settlement amount",
      "final settlement",
      "settlement amount",
    ]);

    if (!supplierSKU && !subOrderNo) continue;

    const rawStatus =
      getVal(row, colMap, ["live order status", "order status", "status"]) ??
      "";
    const orderStatus: OrderStatus = classifyStatus(String(rawStatus ?? ""));

    const listingPrice = getVal(row, colMap, [
      "listing price (incl. taxes)",
      "listing price",
      "price",
    ]);
    const totalSaleAmount = getVal(row, colMap, [
      "total sale amount (incl. shipping & gst)",
      "total sale amount",
      "sale amount",
      "total sale",
    ]);
    const totalSaleReturnAmount = getVal(row, colMap, [
      "total sale return amount",
      "sale return amount",
      "return amount",
    ]);
    const productGSTPercent = getVal(row, colMap, [
      "product gst %",
      "product gst",
      "gst %",
      "gst rate",
    ]);
    const orderDateVal = getVal(row, colMap, ["order date"]);
    const dispatchDateVal = getVal(row, colMap, ["dispatch date", "ship date"]);
    const productName =
      getVal(row, colMap, ["product name", "product", "item name"]) ?? "";
    const catalogID = getVal(row, colMap, ["catalog id", "catalog"]);
    const orderSource = getVal(row, colMap, ["order source", "source"]);

    const meeshoCommission = getVal(row, colMap, [
      "meesho commission",
      "commission",
    ]);
    const fixedFee = getVal(row, colMap, ["fixed fee"]);
    const warehousingFee = getVal(row, colMap, [
      "warehousing fee",
      "warehouse fee",
    ]);
    const returnShippingCharge = getVal(row, colMap, [
      "return shipping charge",
      "return shipping",
    ]);
    const shippingCharge = getVal(row, colMap, ["shipping charge", "shipping"]);
    const otherSupportServiceCharges = getVal(row, colMap, [
      "other support service charges",
      "other charges",
      "other support",
    ]);
    const waivers = getVal(row, colMap, ["waivers"]);
    const tcs = getVal(row, colMap, ["tcs"]);
    const tds = getVal(row, colMap, ["tds"]);
    const compensation = getVal(row, colMap, ["compensation"]);
    const claims = getVal(row, colMap, ["claims"]);
    const recovery = getVal(row, colMap, ["recovery"]);

    const id = subOrderNo ? String(subOrderNo) : `${supplierSKU || "sku"}-${r}`;
    const quantity = parseNumeric(quantityVal) ?? 1;

    const rawFields: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      if (h) rawFields[String(h)] = row[i];
    });

    const order: Order = {
      id: id,
      subOrderNo: subOrderNo ? String(subOrderNo) : "",
      orderDate: parseExcelDate(orderDateVal),
      dispatchDate: parseExcelDate(dispatchDateVal),
      productName: productName ? String(productName) : "",
      supplierSKU: supplierSKU ? String(supplierSKU) : "",
      catalogID: catalogID ? String(catalogID) : undefined,
      orderSource: orderSource ? String(orderSource) : undefined,
      liveOrderStatus: orderStatus,
      rawStatus: String(rawStatus ?? ""),
      listingPrice: parseNumeric(listingPrice),
      quantity: Math.max(0, quantity),
      totalSaleAmount: parseNumeric(totalSaleAmount),
      totalSaleReturnAmount: parseNumeric(totalSaleReturnAmount),
      finalSettlementAmount: parseNumeric(finalSettlementVal),
      productGSTPercent: parseNumeric(productGSTPercent),
      meeshoFees: {
        meeshoCommission: parseNumeric(meeshoCommission),
        fixedFee: parseNumeric(fixedFee),
        warehousingFee: parseNumeric(warehousingFee),
        returnShippingCharge: parseNumeric(returnShippingCharge),
        shippingCharge: parseNumeric(shippingCharge),
        otherSupportServiceCharges: parseNumeric(otherSupportServiceCharges),
        waivers: parseNumeric(waivers),
        tcs: parseNumeric(tcs),
        tds: parseNumeric(tds),
        compensation: parseNumeric(compensation),
        claims: parseNumeric(claims),
        recovery: parseNumeric(recovery),
      },
      rawFields,
      importedAt: now,
    };

    orders.push(order);
  }

  return orders;
}

export function parseAdsSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[],
): AdsCostEntry[] {
  const entries: AdsCostEntry[] = [];
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (raw.length === 0) return entries;

  let headerRowIdx = findHeaderRow(sheet);
  if (headerRowIdx < 0) {
    headerRowIdx = 0;
    warnings.push("Ads Cost sheet: header not detected precisely, using row 1");
  }
  const headers = (raw[headerRowIdx] || []).map((h: any) =>
    h == null ? "" : String(h),
  );
  const colMap = buildColumnMap(headers);
  const now = new Date().toISOString();

  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row) continue;
    const isEmpty = row.every(
      (c: any) => c === "" || c === null || c === undefined,
    );
    if (isEmpty) continue;

    const deductionDuration = getVal(row, colMap, [
      "deduction duration",
      "duration",
      "period",
    ]);
    const deductionDateVal = getVal(row, colMap, ["deduction date", "date"]);
    const campaignID = getVal(row, colMap, ["campaign id", "campaign"]);
    const adCost = getVal(row, colMap, ["ad cost", "ads cost", "cost"]);
    const credits = getVal(row, colMap, ["credits"]);
    const waivers = getVal(row, colMap, ["waivers"]);
    const discounts = getVal(row, colMap, ["discounts"]);
    const adCostNet = getVal(row, colMap, [
      "ad cost incl. credits/waivers/discounts",
      "net ad cost",
      "ad cost net",
    ]);
    const gst = getVal(row, colMap, ["gst", "tax"]);
    const totalAdsCost = getVal(row, colMap, ["total ads cost", "total cost"]);

    const rawFields: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      if (h) rawFields[String(h)] = row[i];
    });

    entries.push({
      id: `ad-${r}-${now}`,
      deductionDuration: deductionDuration
        ? String(deductionDuration)
        : undefined,
      deductionDate: parseExcelDate(deductionDateVal),
      campaignID: campaignID ? String(campaignID) : undefined,
      adCost: parseNumeric(adCost),
      credits: parseNumeric(credits),
      waivers: parseNumeric(waivers),
      discounts: parseNumeric(discounts),
      adCostNet: parseNumeric(adCostNet),
      gst: parseNumeric(gst),
      totalAdsCost: parseNumeric(totalAdsCost),
      rawFields,
      importedAt: now,
    });
  }

  return entries;
}

export function parseReferralSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[],
): ReferralPayment[] {
  const entries: ReferralPayment[] = [];
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (raw.length === 0) return entries;

  let headerRowIdx = findHeaderRow(sheet);
  if (headerRowIdx < 0) {
    headerRowIdx = 0;
    warnings.push(
      "Referral Payments sheet: header not detected precisely, using row 1",
    );
  }
  const headers = (raw[headerRowIdx] || []).map((h: any) =>
    h == null ? "" : String(h),
  );
  const colMap = buildColumnMap(headers);
  const now = new Date().toISOString();

  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row) continue;
    const isEmpty = row.every(
      (c: any) => c === "" || c === null || c === undefined,
    );
    if (isEmpty) continue;

    const dateVal = getVal(row, colMap, ["date", "payment date"]);
    const reason = getVal(row, colMap, ["reason", "type", "description"]);
    const amount = getVal(row, colMap, [
      "amount",
      "payment amount",
      "referral amount",
    ]);
    const subOrderNo = getVal(row, colMap, [
      "sub order no",
      "order no",
      "order id",
    ]);

    const rawFields: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      if (h) rawFields[String(h)] = row[i];
    });

    entries.push({
      id: `ref-${r}-${now}`,
      date: parseExcelDate(dateVal),
      reason: reason ? String(reason) : undefined,
      amount: parseNumeric(amount),
      subOrderNo: subOrderNo ? String(subOrderNo) : undefined,
      rawFields,
      importedAt: now,
    });
  }
  return entries;
}

export function parseCompensationSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[],
): CompensationEntry[] {
  const entries: CompensationEntry[] = [];
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (raw.length === 0) return entries;

  let headerRowIdx = findHeaderRow(sheet);
  if (headerRowIdx < 0) {
    headerRowIdx = 0;
    warnings.push(
      "Compensation and Recovery sheet: header not detected precisely, using row 1",
    );
  }
  const headers = (raw[headerRowIdx] || []).map((h: any) =>
    h == null ? "" : String(h),
  );
  const colMap = buildColumnMap(headers);
  const now = new Date().toISOString();

  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row) continue;
    const isEmpty = row.every(
      (c: any) => c === "" || c === null || c === undefined,
    );
    if (isEmpty) continue;

    const dateVal = getVal(row, colMap, ["date"]);
    const program = getVal(row, colMap, ["program"]);
    const reason = getVal(row, colMap, ["reason", "type"]);
    const compensationAmount = getVal(row, colMap, [
      "compensation",
      "compensation amount",
    ]);
    const recoveryAmount = getVal(row, colMap, ["recovery", "recovery amount"]);
    const subOrderNo = getVal(row, colMap, [
      "sub order no",
      "order no",
      "order id",
    ]);

    const rawFields: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      if (h) rawFields[String(h)] = row[i];
    });

    entries.push({
      id: `comp-${r}-${now}`,
      date: parseExcelDate(dateVal),
      program: program ? String(program) : undefined,
      reason: reason ? String(reason) : undefined,
      compensationAmount: parseNumeric(compensationAmount),
      recoveryAmount: parseNumeric(recoveryAmount),
      subOrderNo: subOrderNo ? String(subOrderNo) : undefined,
      rawFields,
      importedAt: now,
    });
  }
  return entries;
}

export async function parseWorkbookFromFile(
  file: File,
): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  const warnings: string[] = [];
  const errors: string[] = [];
  const sheetsFound = workbook.SheetNames.slice();

  let orders: Order[] = [];
  let ads: AdsCostEntry[] = [];
  let referrals: ReferralPayment[] = [];
  let compensations: CompensationEntry[] = [];

  const orderSheet = findSheet(workbook, [
    "order payment",
    "orderpayment",
    "order report",
    "payment",
  ]);
  if (orderSheet) {
    orders = parseOrderPaymentsSheet(
      workbook.Sheets[orderSheet],
      warnings,
      errors,
    );
  } else {
    errors.push(
      "Order Payments sheet not found. Cannot calculate profit without order data.",
    );
  }

  const adsSheet = findSheet(workbook, [
    "ads cost",
    "ads",
    "advertisement",
    "advertising",
    "ad cost",
  ]);
  if (adsSheet) {
    ads = parseAdsSheet(workbook.Sheets[adsSheet], warnings);
  } else {
    warnings.push(
      "Ads Cost sheet not found — advertising analysis unavailable for this file.",
    );
  }

  const referralSheet = findSheet(workbook, ["referral payment", "referral"]);
  if (referralSheet) {
    referrals = parseReferralSheet(workbook.Sheets[referralSheet], warnings);
  } else {
    warnings.push("Referral Payments sheet not found.");
  }

  const compSheet = findSheet(workbook, [
    "compensation and recovery",
    "compensation",
    "recovery",
  ]);
  if (compSheet) {
    compensations = parseCompensationSheet(
      workbook.Sheets[compSheet],
      warnings,
    );
  } else {
    warnings.push("Compensation and Recovery sheet not found.");
  }

  const validOrders = orders.filter(
    (o) =>
      o.supplierSKU &&
      o.quantity > 0 &&
      o.finalSettlementAmount !== null &&
      o.finalSettlementAmount !== undefined,
  );
  const missingSKU = orders.filter((o) => !o.supplierSKU).length;
  const missingSettlement = orders.filter(
    (o) =>
      o.finalSettlementAmount === null || o.finalSettlementAmount === undefined,
  ).length;

  const uniqueSKUs = new Set(orders.map((o) => o.supplierSKU).filter(Boolean))
    .size;
  const totalQuantity = orders.reduce((s, o) => s + (o.quantity ?? 0), 0);

  const dates = orders
    .map((o) => o.orderDate)
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
  const dateRangeStart = dates.length
    ? new Date(Math.min(...dates.map((d) => d.getTime())))
    : null;
  const dateRangeEnd = dates.length
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : null;

  const summary: ImportSummary = {
    fileName: file.name,
    sheetsFound,
    ordersFound: orders.length,
    validOrders: validOrders.length,
    duplicateOrders: 0,
    missingSKU,
    missingSettlement,
    uniqueSKUs,
    totalQuantity,
    dateRangeStart,
    dateRangeEnd,
    adsEntriesFound: ads.length,
    referralPaymentsFound: referrals.length,
    compensationEntriesFound: compensations.length,
    warnings,
    errors,
  };

  return { orders, ads, referrals, compensations, summary };
}
