import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { aggregateBySKU } from "@/calculations";
import { formatINR, formatPercent, formatNumber } from "@/lib/utils";
import { SKUAggregate } from "@/types";
import { cn } from "@/lib/utils";

type SortKey =
  | "profit-desc"
  | "profit-asc"
  | "margin-desc"
  | "margin-asc"
  | "sales-desc"
  | "units-desc"
  | "roi-desc"
  | "rto-desc"
  | "loss-asc"
  | "profitPerUnit-desc"
  | "profitPerUnit-asc";

export default function SKUAnalysisPage() {
  const navigate = useNavigate();
  const { enrichedOrders } = useApp();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("profit-desc");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);

  const skuAggs: SKUAggregate[] = useMemo(
    () => aggregateBySKU(enrichedOrders),
    [enrichedOrders]
  );

  const filtered = useMemo(() => {
    let list = skuAggs;
    if (missingOnly) list = list.filter((s) => s.hasMissingCost);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.supplierSKU.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q)
      );
    }
    const copy = list.slice();
    switch (sort) {
      case "profit-desc":
        copy.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
        break;
      case "profit-asc":
        copy.sort((a, b) => (a.profit ?? Infinity) - (b.profit ?? Infinity));
        break;
      case "margin-desc":
        copy.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
        break;
      case "margin-asc":
        copy.sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity));
        break;
      case "sales-desc":
        copy.sort((a, b) => b.sales - a.sales);
        break;
      case "units-desc":
        copy.sort((a, b) => (b.unitsSold ?? b.units) - (a.unitsSold ?? a.units));
        break;
      case "roi-desc":
        copy.sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity));
        break;
      case "rto-desc":
        copy.sort((a, b) => (b.rtoCount ?? 0) - (a.rtoCount ?? 0));
        break;
      case "loss-asc":
        copy.sort((a, b) => (a.profit ?? Infinity) - (b.profit ?? -Infinity));
        break;
      case "profitPerUnit-desc":
        copy.sort(
          (a, b) =>
            (b.profitPerUnit ?? -Infinity) - (a.profitPerUnit ?? -Infinity)
        );
        break;
      case "profitPerUnit-asc":
        copy.sort(
          (a, b) => (a.profitPerUnit ?? Infinity) - (b.profitPerUnit ?? Infinity)
        );
        break;
    }
    return copy;
  }, [skuAggs, search, sort, missingOnly]);

  const ordersForSKU = useMemo(() => {
    if (!selectedSKU) return [];
    return enrichedOrders.filter((o) => o.supplierSKU === selectedSKU);
  }, [enrichedOrders, selectedSKU]);

  const selected = selectedSKU
    ? skuAggs.find((s) => s.supplierSKU === selectedSKU)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            SKU Analysis
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            {filtered.length} of {skuAggs.length} SKUs · Click a row to drill
            down into its orders.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search SKU or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-56"
          >
            <option value="profit-desc">🔼 Highest Total Profit</option>
            <option value="loss-asc">🔽 Highest Loss</option>
            <option value="profitPerUnit-desc">🔼 Highest Profit / Unit</option>
            <option value="profitPerUnit-asc">🔽 Lowest Profit / Unit</option>
            <option value="margin-desc">🔼 Highest Margin</option>
            <option value="margin-asc">🔽 Lowest Margin</option>
            <option value="sales-desc">🔼 Highest Sales</option>
            <option value="units-desc">🔼 Highest Units Sold</option>
            <option value="roi-desc">🔼 Highest ROI</option>
            <option value="rto-desc">🔼 Highest RTO Count</option>
          </Select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            Missing cost only
          </label>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <Th label="SKU" />
                  <Th label="Product" />
                  <Th label="Units Sold" right />
                  <Th label="Sales" right />
                  <Th label="Settlement" right />
                  <Th label="COGS" right />
                  <Th label="Ad Cost" right />
                  <Th label="Profit / Unit" right />
                  <Th label="Total Profit" right />
                  <Th label="Margin" right />
                  <Th label="RTO" right />
                  <Th label="Ret" right />
                  <Th label="Cxl" right />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="text-center py-12 text-slate-500 text-sm"
                    >
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      No SKUs. Upload a report or adjust filters.
                    </td>
                  </tr>
                )}
                {filtered.map((s) => {
                  const isSelected = selectedSKU === s.supplierSKU;
                  const profitClass =
                    s.profit === null
                      ? "text-slate-400"
                      : s.profit >= 0
                        ? "text-emerald-700"
                        : "text-red-700";
                  const ppuClass =
                    s.profitPerUnit === null
                      ? "text-slate-400"
                      : s.profitPerUnit >= 0
                        ? "text-emerald-700"
                        : "text-red-700";
                  return (
                    <tr
                      key={s.supplierSKU}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected
                          ? "bg-emerald-50"
                          : s.hasMissingCost
                            ? "bg-yellow-50/60 hover:bg-yellow-50"
                            : "hover:bg-slate-50",
                      )}
                      onClick={() =>
                        setSelectedSKU(isSelected ? null : s.supplierSKU)
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap">
                        {s.supplierSKU}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[220px] truncate"
                        title={s.productName}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <ChevronUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-300" />
                          )}
                          <span className="truncate">{s.productName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(s.unitsSold ?? s.units).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatINR(s.sales)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatINR(s.settlement)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatINR(s.cogs)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {s.adCost ? formatINR(s.adCost) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums font-medium",
                          ppuClass,
                        )}
                      >
                        {s.profitPerUnit !== null &&
                        s.profitPerUnit !== undefined
                          ? formatINR(s.profitPerUnit)
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums font-semibold",
                          profitClass,
                        )}
                      >
                        {formatINR(s.profit)}
                        {s.hasMissingCost && (
                          <Badge variant="warning" className="ml-2">
                            Missing
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.margin !== null ? formatPercent(s.margin, 1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <CountPill
                          value={s.rtoCount ?? 0}
                          tone={s.rtoCount ? "warn" : "muted"}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <CountPill
                          value={s.returnCount ?? 0}
                          tone={s.returnCount ? "warn" : "muted"}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <CountPill
                          value={s.cancellationCount ?? 0}
                          tone={s.cancellationCount ? "danger" : "muted"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              SKU Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {selected ? (
              <>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    SKU
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {selected.supplierSKU}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    Product
                  </div>
                  <div className="text-sm text-slate-800">
                    {selected.productName}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <Stat
                    label="Units Sold"
                    value={(selected.unitsSold ?? selected.units).toLocaleString(
                      "en-IN",
                    )}
                  />
                  <Stat
                    label="Profit / Unit"
                    value={
                      selected.profitPerUnit !== null &&
                      selected.profitPerUnit !== undefined
                        ? formatINR(selected.profitPerUnit)
                        : "—"
                    }
                  />
                  <Stat label="Sales" value={formatINR(selected.sales)} />
                  <Stat
                    label="Settlement"
                    value={formatINR(selected.settlement)}
                  />
                  <Stat label="COGS" value={formatINR(selected.cogs)} />
                  <Stat
                    label="Input GST"
                    value={formatINR(selected.inputGST)}
                  />
                  <Stat
                    label="Ad Cost"
                    value={selected.adCost ? formatINR(selected.adCost) : "—"}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <Stat
                    label="RTO"
                    value={(selected.rtoCount ?? 0).toString()}
                    small
                    valueClass="text-orange-700"
                    icon={selected.rtoCount ? RotateCcw : undefined}
                  />
                  <Stat
                    label="Returns"
                    value={(selected.returnCount ?? 0).toString()}
                    small
                  />
                  <Stat
                    label="Cancelled"
                    value={(selected.cancellationCount ?? 0).toString()}
                    small
                    valueClass="text-red-700"
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <Stat
                    label="Profit"
                    value={formatINR(selected.profit)}
                    valueClass={
                      selected.profit === null
                        ? "text-slate-500"
                        : selected.profit >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                    }
                    icon={
                      selected.profit !== null && selected.profit >= 0
                        ? TrendingUp
                        : TrendingDown
                    }
                  />
                  <div className="flex gap-3 mt-2">
                    <Stat
                      label="Margin"
                      value={
                        selected.margin !== null
                          ? formatPercent(selected.margin, 1)
                          : "—"
                      }
                      small
                    />
                    <Stat
                      label="ROI"
                      value={
                        selected.roi !== null
                          ? formatPercent(selected.roi, 1)
                          : "—"
                      }
                      small
                    />
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                      Orders ({ordersForSKU.length})
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/orders?sku=${encodeURIComponent(selected.supplierSKU)}`,
                        )
                      }
                    >
                      View all →
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                    {ordersForSKU.slice(0, 20).map((o) => (
                      <div
                        key={o.id}
                        className="text-xs p-2 rounded bg-white border border-slate-100"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-slate-500">
                            {o.subOrderNo || "—"}
                          </span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              (o.netProfit ?? 0) >= 0
                                ? "text-emerald-700"
                                : "text-red-700",
                            )}
                          >
                            {formatINR(o.netProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between mt-0.5 text-slate-500">
                          <span>Qty {o.quantity}</span>
                          <span>{formatINR(o.finalSettlementAmount)}</span>
                        </div>
                      </div>
                    ))}
                    {ordersForSKU.length === 0 && (
                      <div className="text-xs text-slate-400 text-center py-4">
                        No orders
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Click any SKU row on the left to see details and orders.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CountPill({
  value,
  tone,
}: {
  value: number;
  tone: "warn" | "danger" | "muted";
}) {
  if (value === 0) {
    return <span className="text-slate-400 text-xs">0</span>;
  }
  const cls = {
    warn: "bg-orange-100 text-orange-800 border-orange-200",
    danger: "bg-red-100 text-red-800 border-red-200",
    muted: "bg-slate-100 text-slate-800 border-slate-200",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-semibold border",
        cls,
      )}
    >
      {value}
    </span>
  );
}

function Th({ label, right }: { label: string; right?: boolean }) {
  return (
    <th
      className={cn(
        "font-semibold px-3 py-2.5 whitespace-nowrap",
        right ? "text-right" : "text-left",
      )}
    >
      {label}
    </th>
  );
}

function Stat({
  label,
  value,
  valueClass,
  icon: Icon,
  small,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: any;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon className={cn("w-3.5 h-3.5", valueClass)} />}
        {label}
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums",
          small ? "text-sm" : "text-lg",
          valueClass || "text-slate-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}
