import type { AdsCostEntry } from "@/types";
import { parseNumeric } from "./utils";
const normalize = (key: string) => key.toLowerCase().replace(/[\s_\-().,/]/g, "");
export function isMalformedAd(entry: AdsCostEntry): boolean {
  const keys = Object.keys(entry.rawFields ?? {}).map(normalize);
  // The old parser used the title row as a header and treated column A's
  // dates as costs. None of the real advertising columns survived that import.
  return keys.length === 1 && keys[0] === "adscost";
}
export function normalizeStoredAd(entry: AdsCostEntry): AdsCostEntry {
  const fields = new Map(Object.entries(entry.rawFields ?? {}).map(([key, value]) => [normalize(key), value]));
  const combined = fields.has("creditswaiversdiscounts");
  const netKey = "adcostinclcreditswaiversdiscounts";
  if (!combined || !fields.has(netKey) || !fields.has("totaladscost")) return entry;
  const negate = (value: unknown) => { const number = parseNumeric(value); return number === null ? null : -number; };
  return { ...entry, adCost: parseNumeric(fields.get("adcost")), credits: parseNumeric(fields.get("creditswaiversdiscounts")), adCostNet: negate(fields.get(netKey)), gst: negate(fields.get("gst")), totalAdsCost: negate(fields.get("totaladscost")) };
}
export function usableAds(entries: AdsCostEntry[]): AdsCostEntry[] {
  return entries.filter(entry => !isMalformedAd(entry)).map(normalizeStoredAd);
}
