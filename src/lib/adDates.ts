import type { AdsCostEntry } from "@/types";
import { getMonthKey } from "./utils";

// Resolve a reporting month without inventing a transaction date. A period
// spanning months stays undated until the source supplies an actual date.
export function getAdMonthKey(ad: Pick<AdsCostEntry, "deductionDate" | "deductionDuration">): string {
  const dated = getMonthKey(ad.deductionDate);
  if (dated !== "unknown") return dated;
  const period = ad.deductionDuration?.trim();
  if (!period) return "unknown";
  const months: string[] = [];
  let invalid = false;
  const add = (year: number, month: number, day = 1) => {
    const date = new Date(year, month - 1, day);
    if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) invalid = true;
    else months.push(`${year}-${String(month).padStart(2, "0")}`);
  };
  let rest = period.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (_, y, m, d) => { add(+y, +m, +d); return " "; });
  rest = rest.replace(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g, (_, d, m, y) => { add(+y, +m, +d); return " "; });
  const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  rest = rest.replace(/\b(?:(\d{1,2})\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b/gi, (_, d, m, y) => { add(+y, names.indexOf(m.slice(0, 3).toLowerCase()) + 1, d ? +d : 1); return " "; });
  rest = rest.replace(/\b(\d{4})-(\d{1,2})\b/g, (_, y, m) => { add(+y, +m); return " "; });
  // Reject leftover numbers or month names: an incomplete second endpoint
  // must not turn a multi-month period into a single-month attribution.
  const unresolved = /\d|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(rest);
  return !invalid && !unresolved && months.length > 0 && months.every(month => month === months[0]) ? months[0] : "unknown";
}
