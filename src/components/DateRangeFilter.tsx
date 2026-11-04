import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ left: 12, top: 12, width: 340, maxHeight: 400 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
      const topEdge = (viewport?.offsetTop ?? 0) + 12;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24;
      const anchor = trigger.current.getBoundingClientRect();
      const width = Math.min(340, rightEdge - leftEdge);
      const below = Math.max(0, bottomEdge - anchor.bottom - 8);
      const above = Math.max(0, anchor.top - topEdge - 8);
      const downward = below >= Math.min(panel.current.scrollHeight, 320) || below >= above;
      const maxHeight = Math.max(1, Math.min(bottomEdge - topEdge, downward ? below : above));
      const height = Math.min(panel.current.scrollHeight + 2, maxHeight);
      const next = {
        width, maxHeight,
        left: Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width)),
        top: Math.max(topEdge, Math.min(downward ? anchor.bottom + 8 : anchor.top - height - 8, bottomEdge - height)),
      };
      setPosition(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel.current!);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, dateFilterType]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

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
    <div className="relative min-w-0 max-w-full">
      <button
        ref={trigger}
        aria-label="Date range"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex max-w-full min-w-0 items-center gap-2 min-h-9 px-3 py-2 rounded-md border text-sm transition-colors",
          isFiltered
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        )}
      >
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="font-medium whitespace-nowrap">{activeLabel}</span>
        {rangeLabel && (
          <span className="hidden lg:inline min-w-0 truncate text-xs text-slate-500" title={rangeLabel}>
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

      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div ref={panel} id={id} role="dialog" aria-label="Date range filter" style={position} className="fixed z-50 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2">
            {rangeLabel && <p className="text-xs text-slate-500 break-words">{rangeLabel}</p>}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={`${id}-from`} className="text-[11px] text-slate-500 font-medium">
                      From
                    </label>
                    <Input
                      id={`${id}-from`}
                      className="min-w-0 max-w-full"
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
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={`${id}-to`} className="text-[11px] text-slate-500 font-medium">
                      To
                    </label>
                    <Input
                      id={`${id}-to`}
                      className="min-w-0 max-w-full"
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
        </>, document.body
      )}
    </div>
  );
}
