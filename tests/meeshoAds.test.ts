import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseAdsSheet } from "@/services/excelParser";
import { parseNumeric } from "@/lib/utils";
import { isMalformedAd, usableAds } from "@/lib/adIntegrity";
import { mergeEntries } from "@/services/dataIntegrity";
import type { AdsCostEntry } from "@/types";
const header = ["Deduction Duration", "Deduction Date", "Campaign ID", "Ad Cost", "Credits / Waivers / Discounts", "Ad Cost incl. Credits/Waivers/Discounts", "GST", "Total Ads Cost"];
const sheet = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet([["Ads Cost"], header, ["", "", "", "A", "B", "(A + B)"], ...rows]);
const parse = (rows: unknown[][]) => parseAdsSheet(sheet(rows), []);
const row = (cost: number, total: number, month = "09") => [`2026-${month}-01`, `2026-${month}-03`, "campaign", cost, 0, -cost, Math.round((-total + cost)*100)/100, -total];
describe("Meesho signed advertising deductions", () => {
  it("skips titles and explanatory rows, using the real row 2 header", () => {
    const result = parse([row(1.7, 2.01)]);
    expect(result).toHaveLength(1); expect(result[0].totalAdsCost).toBe(2.01);
    expect(result[0].deductionDate?.getMonth()).toBe(8); expect(result[0].gst).toBeCloseTo(.31);
  });
  it("reconciles September source amounts", () => {
    const totals = [2.01,2.31,54.4,81.43,52.47,.76,.37,5.3,18.42,6.01,13.79,13.92,102.26,76.75,6.57,51.34,2.62,1.88,.24,.21,1.81,.12,4.72,10.02,12.43,79.64,171.31,81.66,2.37];
    const costs = [1.7,1.96,46.1,69.01,44.47,.64,.31,4.49,15.61,5.09,11.69,11.8,86.66,65.04,5.57,43.51,2.22,1.59,.2,.18,1.53,.1,4,8.49,10.53,67.49,145.18,69.2,2.01];
    const result = parse(totals.map((total, index) => row(costs[index], total)));
    expect(result).toHaveLength(29); expect(result.reduce((sum, ad) => sum + ad.totalAdsCost!, 0)).toBeCloseTo(857.14);
    expect(result.reduce((sum, ad) => sum + ad.adCost!, 0)).toBeCloseTo(726.37);
  });
  it("reconciles October source amounts", () => {
    const totals = [11.23,380.92,94,21.18,172.56,5.95,319.66,2.12];
    const costs = [9.52,322.81,79.66,17.95,146.24,5.04,270.9,1.8];
    const result = parse(totals.map((total,index) => row(costs[index],total,"10")));
    expect(result).toHaveLength(8); expect(result.reduce((sum, ad) => sum + ad.totalAdsCost!, 0)).toBeCloseTo(1007.62);
  });
  it("keeps positive settlement credits as expense reductions", () => {
    const result = parse([["2026-09-01","2026-09-03","campaign",-10,0,10,1.8,11.8]]);
    expect(result[0].totalAdsCost).toBe(-11.8);
  });
  it("does not count summary totals again", () => expect(parse([row(10,11.8),["Grand Total","","",10,0,-10,-1.8,-11.8]])).toHaveLength(1));
  it("does not interpret dates or identifiers with text as money", () => {
    expect(parseNumeric("2026-09-01")).toBeNull(); expect(parseNumeric("2026/09/01")).toBeNull(); expect(parseNumeric("Campaign 2026")).toBeNull();
    expect(parseNumeric("INR 1,864.76")).toBe(1864.76); expect(parseNumeric("(1,000.00)")).toBe(-1000);
  });
  it("excludes legacy date-as-cost corruption from calculations", () => {
    const bad: AdsCostEntry = {id:"old",deductionDate:null,adCost:2026,totalAdsCost:null,rawFields:{"Ads Cost":"2026-09-01"},importedAt:""};
    expect(isMalformedAd(bad)).toBe(true); expect(usableAds([bad])).toEqual([]);
  });
  it("repairs previously saved signed entries without double-normalizing", () => {
    const parsed = parse([row(10,11.8)])[0];
    const saved = {...parsed,totalAdsCost:-11.8,gst:-1.8};
    expect(usableAds([saved])[0].totalAdsCost).toBe(11.8);
    expect(usableAds(usableAds([saved]))).toEqual(usableAds([saved]));
  });
  it("does not duplicate corrected entries on repeated imports", () => {
    const first = parse([row(10,11.8)]); const second = first.map(ad => ({...ad,id:"new",importedAt:"later"}));
    expect(mergeEntries(first,second)).toHaveLength(1);
  });
});
