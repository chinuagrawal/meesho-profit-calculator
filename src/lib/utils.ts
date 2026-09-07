import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatIndianGrouping(num: number, decimals: number): string {
  const negative = num < 0;
  const abs = Math.abs(num);
  const fixed = abs.toFixed(decimals);
  const [intPartRaw, decPart] = fixed.split(".");
  const intPart = intPartRaw || "0";
  const len = intPart.length;
  let grouped: string;
  if (len <= 3) {
    grouped = intPart;
  } else {
    const last3 = intPart.slice(len - 3);
    const rest = intPart.slice(0, len - 3);
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${restGrouped},${last3}`;
  }
  const out = decPart && decimals > 0 ? `${grouped}.${decPart}` : grouped;
  return negative ? `-${out}` : out;
}

export function formatINR(
  value: number | null | undefined,
  decimals: number = 2,
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const negative = value < 0;
  const formatted = formatIndianGrouping(value, decimals);
  if (negative) {
    return `-₹${formatted.slice(1)}`;
  }
  return `₹${formatted}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  decimals: number = 2,
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${formatNumber(value, decimals)}%`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatMonthYear(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function getMonthKey(date: Date | string | null | undefined): string {
  if (!date) return "unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.\-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

export function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0 ||
    isNaN(numerator) ||
    isNaN(denominator)
  ) {
    return null;
  }
  return numerator / denominator;
}

import type { CalculationStatus } from "@/types";

export function calculationStatusLabel(s: CalculationStatus): string {
  const map: Record<CalculationStatus, string> = {
    PROFIT: "Profit",
    LOSS: "Loss",
    RTO: "RTO",
    CANCELLED: "Cancelled",
    COST_MISSING: "Cost Missing",
    REVIEW_REQUIRED: "Review Required",
    NO_SETTLEMENT: "No Settlement",
    INVALID_DATA: "Invalid Data",
  };
  return map[s] ?? String(s);
}

export function calculationStatusBadgeVariant(
  s: CalculationStatus,
): "success" | "danger" | "warning" | "muted" | "info" | "default" {
  switch (s) {
    case "PROFIT":
      return "success";
    case "LOSS":
      return "danger";
    case "RTO":
      return "warning";
    case "CANCELLED":
      return "muted";
    case "COST_MISSING":
      return "warning";
    case "REVIEW_REQUIRED":
      return "info";
    case "NO_SETTLEMENT":
      return "muted";
    case "INVALID_DATA":
      return "danger";
    default:
      return "default";
  }
}

export function calculationStatusRowClass(s: CalculationStatus): string {
  switch (s) {
    case "PROFIT":
      return "bg-emerald-50/40 hover:bg-emerald-50/70";
    case "LOSS":
      return "bg-red-50/40 hover:bg-red-50/70";
    case "RTO":
      return "bg-amber-50/50 hover:bg-amber-50";
    case "CANCELLED":
      return "bg-slate-100/60 hover:bg-slate-100";
    case "COST_MISSING":
      return "bg-yellow-50/40 hover:bg-yellow-50/70";
    case "REVIEW_REQUIRED":
      return "bg-blue-50/50 hover:bg-blue-50";
    case "NO_SETTLEMENT":
      return "bg-slate-50 hover:bg-slate-100";
    case "INVALID_DATA":
      return "bg-red-50/30 hover:bg-red-50/60";
    default:
      return "";
  }
}
