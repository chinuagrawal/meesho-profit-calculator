import { useState } from "react";
import { Calendar, X, ChevronDown } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DateFilterType } from "@/types";
import { formatDate, formatDateISO, cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

const FILTER_OPTIONS: { value: DateFilterType; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom" },
];

export function DateRangeFilter() {
  const {
    dateFilterType,
    dateRange,
    customDateFrom,
    customDateTo,
    setDateFilterType,
    setCustomDateRange,
    clearDateFilter,
    filteredEnrichedOrders,
    enrichedOrders,
  } = useApp();

  const [open, setOpen] = useState(false);

  const activeLabel =
    FILTER_OPTIONS.find((o) => o.value === dateFilterType)?.label ?? "All Time";

  const rangeLabel = (() => {
    if (dateFilterType === "all") return null;
    if (dateFilterType === "custom") {
      if (!customDateFrom && !customDateTo) return null;
      const from = customDateFrom ? formatDate(customDateFrom) : "…";
      const to = customDateTo ? formatDate(customDateTo) : "…";
      return `${from} → ${to}`;
    }
    if (dateRange.start && dateRange.end) {
      return `${formatDate(dateRange.start)} → ${formatDate(dateRange.end)}`;
    }
    return null;
  })();

  const isFiltered = dateFilterType !== "all";
  const filteredCount = filteredEnrichedOrders.length;
  const totalCount = enrichedOrders.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border text-sm transition-colors",
          isFiltered
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        )}
      >
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="font-medium whitespace-nowrap">{activeLabel}</span>
        {rangeLabel && (
          <span className="hidden lg:inline text-xs text-slate-500 whitespace-nowrap">
            · {rangeLabel}
          </span>
        )}
        {isFiltered && (
          <span className="hidden md:inline text-[10px] font-semibold bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-700">
            {filteredCount}/{totalCount}
          </span>
        )}
        {isFiltered && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clearDateFilter();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                clearDateFilter();
              }
            }}
            className="shrink-0 p-0.5 rounded hover:bg-emerald-200/60 text-emerald-700 transition-colors"
            title="Clear date filter"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setDateFilterType(opt.value);
                    if (opt.value !== "custom") setOpen(false);
                  }}
                  className={cn(
                    "h-9 px-2.5 rounded-md text-xs font-medium transition-colors border text-left",
                    dateFilterType === opt.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {dateFilterType === "custom" && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Custom Range
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">
                      From
                    </label>
                    <Input
                      type="date"
                      value={customDateFrom ? formatDateISO(customDateFrom) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDateRange(
                          val ? new Date(val) : null,
                          customDateTo,
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">
                      To
                    </label>
                    <Input
                      type="date"
                      value={customDateTo ? formatDateISO(customDateTo) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDateRange(
                          customDateFrom,
                          val ? new Date(val) : null,
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {isFiltered && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Showing <strong>{filteredCount}</strong> of{" "}
                  <strong>{totalCount}</strong> orders
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearDateFilter();
                    setOpen(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" /> Reset
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
