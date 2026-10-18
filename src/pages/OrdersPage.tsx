import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingBag,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  AlertTriangle,
  Package,
  CheckCircle2,
  XCircle,
  Calculator,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Badge,
  Button,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import {
  OrderWithCalculations,
  OrderStatus,
  CalculationStatus,
  PerOrderReturnCondition,
} from "@/types";
import {
  formatDate,
  formatINR,
  formatNumber,
  calculationStatusLabel,
  calculationStatusBadgeVariant,
  calculationStatusRowClass,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const CALC_STATUSES: { value: CalculationStatus | "all"; label: string }[] = [
  { value: "all", label: "All Calculation Statuses" },
  { value: "PROFIT", label: "🟢 Profit" },
  { value: "LOSS", label: "🔴 Loss" },
  { value: "COST_MISSING", label: "🟡 Cost Missing" },
  { value: "CANCELLED", label: "⚪ Cancelled" },
  { value: "RTO", label: "🟠 RTO" },
  { value: "REVIEW_REQUIRED", label: "🔵 Review Required" },
  { value: "NO_SETTLEMENT", label: "⚪ No Settlement" },
  { value: "INVALID_DATA", label: "🔴 Invalid Data" },
];

const ORDER_STATUSES: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All Order Statuses" },
  { value: "Delivered", label: "Delivered" },
  { value: "Shipped", label: "Shipped" },
  { value: "Returned", label: "Returned" },
  { value: "RTO", label: "RTO" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Pending", label: "Pending" },
  { value: "Other", label: "Other" },
];

export default function OrdersPage() {
  const { enrichedOrders, filteredEnrichedOrders, skuCosts, dateFilterType, returnOverrides } =
    useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skuParam = searchParams.get("sku") || "";
  const filterParam = searchParams.get("filter") || "";

  const [search, setSearch] = useState(skuParam);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [rowStatusFilter, setRowStatusFilter] = useState<
    CalculationStatus | "all"
  >("all");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [rtoOnly, setRtoOnly] = useState(false);
  const [cancelledOnly, setCancelledOnly] = useState(false);
  const [negativeSettlementOnly, setNegativeSettlementOnly] = useState(false);
  const [profitLossFilter, setProfitLossFilter] = useState<
    "all" | "profit" | "loss"
  >("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (skuParam) setSearch(skuParam);
    setMissingOnly(filterParam === "missing");
    if (filterParam === "rto") setRtoOnly(true);
    if (filterParam === "cancelled") setCancelledOnly(true);
    if (filterParam === "negative") setNegativeSettlementOnly(true);
    setPage(1);
  }, [skuParam, filterParam]);

  const filtered = useMemo(() => {
    let list = filteredEnrichedOrders;
    if (filterParam === "returns-review") list = list.filter(o => o.liveOrderStatus === "Returned" && !returnOverrides[o.subOrderNo]);

    if (skuParam) {
      list = list.filter(
        (o) => o.supplierSKU.toLowerCase() === skuParam.toLowerCase(),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((o) => o.liveOrderStatus === statusFilter);
    }
    if (rowStatusFilter !== "all") {
      list = list.filter((o) => o.rowStatus === rowStatusFilter);
    }
    if (missingOnly) {
      list = list.filter((o) => o.hasMissingCost);
    }
    if (rtoOnly) {
      list = list.filter((o) => o.liveOrderStatus === "RTO");
    }
    if (cancelledOnly) {
      list = list.filter((o) => o.liveOrderStatus === "Cancelled");
    }
    if (negativeSettlementOnly) {
      list = list.filter(
        (o) =>
          o.finalSettlementAmount !== null &&
          o.finalSettlementAmount !== undefined &&
          o.finalSettlementAmount < 0,
      );
    }
    if (profitLossFilter === "profit") {
      list = list.filter(
        (o) =>
          o.netProfit !== null && o.netProfit !== undefined && o.netProfit >= 0,
      );
    } else if (profitLossFilter === "loss") {
      list = list.filter(
        (o) =>
          o.netProfit !== null && o.netProfit !== undefined && o.netProfit < 0,
      );
    }
    if (dateFrom) {
      const d = new Date(dateFrom);
      list = list.filter((o) => o.orderDate && o.orderDate >= d);
    }
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      list = list.filter((o) => o.orderDate && o.orderDate <= d);
    }
    if (search.trim() && !skuParam) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.subOrderNo.toLowerCase().includes(q) ||
          o.supplierSKU.toLowerCase().includes(q) ||
          (o.productName || "").toLowerCase().includes(q),
      );
    }
    return list.slice().sort((a, b) => {
      const da = a.orderDate?.getTime() ?? 0;
      const db = b.orderDate?.getTime() ?? 0;
      return db - da;
    });
  }, [
    filteredEnrichedOrders,
    statusFilter,
    rowStatusFilter,
    missingOnly,
    rtoOnly,
    cancelledOnly,
    negativeSettlementOnly,
    filterParam,
    returnOverrides,
    profitLossFilter,
    dateFrom,
    dateTo,
    search,
    skuParam,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const missingCount = skuCosts.filter(
    (s) =>
      s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
  ).length;

  const negativeCount = filteredEnrichedOrders.filter(
    (o) =>
      o.finalSettlementAmount !== null &&
      o.finalSettlementAmount !== undefined &&
      o.finalSettlementAmount < 0,
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-600" />
          Orders
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          {filtered.length.toLocaleString("en-IN")} of{" "}
          {filteredEnrichedOrders.length.toLocaleString("en-IN")}
          {dateFilterType !== "all" && (
            <>
              {" "}
              (
              <span className="text-slate-400">
                total {enrichedOrders.length.toLocaleString("en-IN")}
              </span>
              )
            </>
          )}{" "}
          orders shown.{" "}
          {skuParam && (
            <span className="inline-flex items-center gap-2">
              <Badge variant="info">Filtering by SKU: {skuParam}</Badge>
              <button
                className="text-xs underline text-slate-500"
                onClick={() => navigate("/orders")}
              >
                Clear
              </button>
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search Sub Order No, SKU, Product..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "all");
              setPage(1);
            }}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            value={rowStatusFilter}
            onChange={(e) => {
              setRowStatusFilter(e.target.value as CalculationStatus | "all");
              setPage(1);
            }}
          >
            {CALC_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            value={profitLossFilter}
            onChange={(e) => {
              setProfitLossFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">All Profit / Loss</option>
            <option value="profit">Profitable Only</option>
            <option value="loss">Loss Only</option>
          </Select>

          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <FilterChip
              active={missingOnly}
              onClick={() => {
                setMissingOnly((v) => !v);
                setPage(1);
              }}
              label={`Missing cost (${missingCount})`}
              tone="warn"
            />
            <FilterChip
              active={rtoOnly}
              onClick={() => {
                setRtoOnly((v) => !v);
                setPage(1);
              }}
              label="RTO only"
              tone="warn"
            />
            <FilterChip
              active={cancelledOnly}
              onClick={() => {
                setCancelledOnly((v) => !v);
                setPage(1);
              }}
              label="Cancelled only"
              tone="muted"
            />
            <FilterChip
              active={negativeSettlementOnly}
              onClick={() => {
                setNegativeSettlementOnly((v) => !v);
                setPage(1);
              }}
              label={`Negative settlement (${negativeCount})`}
              tone="danger"
            />
            <div className="flex items-center gap-2 text-sm text-slate-600 flex-1 min-w-[300px] justify-end">
              <span className="whitespace-nowrap">From:</span>
              <Input
                type="date"
                className="w-auto max-w-[180px]"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span className="whitespace-nowrap">To:</span>
              <Input
                type="date"
                className="w-auto max-w-[180px]"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Orders ({filtered.length.toLocaleString("en-IN")})</span>
            <span className="text-xs font-normal text-slate-500">
              Page {currentPage} / {totalPages}
            </span>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto scrollbar-thin max-h-[calc(100vh-340px)]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 text-slate-700 border-b">
              <tr>
                <th className="w-8 px-2 py-2.5"></th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                  Order Date
                </th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                  Sub Order No
                </th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap max-w-[220px]">
                  Product
                </th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                  SKU
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Qty
                </th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">
                  Status
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Settlement
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Purchase Incl GST
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Input GST
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  COGS (Excl GST)
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Cash Profit Before Ads
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Ad Cost
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Net Cash Profit
                </th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                  Margin %
                </th>
                <th className="text-center font-semibold px-3 py-2.5 whitespace-nowrap">
                  Calc Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="py-14 text-center text-slate-500">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <div className="font-medium">No orders to show</div>
                    <div className="text-xs mt-1">
                      {enrichedOrders.length === 0
                        ? "Import a Meesho report to see orders"
                        : "Try adjusting filters"}
                    </div>
                    {enrichedOrders.length === 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3"
                        onClick={() => navigate("/import")}
                      >
                        Go to Import
                      </Button>
                    )}
                  </td>
                </tr>
              )}
              {paged.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  expanded={expandedOrderId === o.id}
                  onToggle={() =>
                    setExpandedOrderId((prev) => (prev === o.id ? null : o.id))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 text-xs mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg =
                  totalPages <= 5
                    ? i + 1
                    : Math.max(1, Math.min(totalPages - 4, currentPage - 2)) +
                      i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={cn(
                      "w-7 h-7 rounded-md text-xs font-medium",
                      pg === currentPage
                        ? "bg-slate-900 text-white"
                        : "hover:bg-slate-200 text-slate-700",
                    )}
                  >
                    {pg}
                  </button>
                );
              })}
            </div>
            <button
              className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "warn" | "danger" | "muted";
}) {
  const tones = {
    warn: active
      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
      : "bg-white text-slate-600 border-slate-200 hover:bg-yellow-50",
    danger: active
      ? "bg-red-100 text-red-800 border-red-300"
      : "bg-white text-slate-600 border-slate-200 hover:bg-red-50",
    muted: active
      ? "bg-slate-100 text-slate-800 border-slate-300"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-3 h-8 rounded-md text-xs font-medium border transition-colors",
        tones[tone],
      )}
    >
      <Filter className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function OrderRow({
  order,
  expanded,
  onToggle,
}: {
  order: OrderWithCalculations;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { setReturnOverride } = useApp();
  const rowColor = calculationStatusRowClass(order.rowStatus);

  const profitClass =
    order.cashProfitBeforeAds === null
      ? "text-slate-400"
      : order.cashProfitBeforeAds >= 0
        ? "text-emerald-700"
        : "text-red-700";
  const netClass =
    order.netProfit === null
      ? "text-slate-400"
      : order.netProfit >= 0
        ? "text-emerald-700"
        : "text-red-700";

  const statusBadge = {
    Delivered: <Badge variant="success">Delivered</Badge>,
    Shipped: <Badge variant="info">Shipped</Badge>,
    Cancelled: <Badge variant="muted">Cancelled</Badge>,
    Returned: <Badge variant="warning">Returned</Badge>,
    RTO: <Badge variant="warning">RTO</Badge>,
    Pending: <Badge variant="default">Pending</Badge>,
    Other: <Badge variant="default">Other</Badge>,
  }[order.liveOrderStatus];

  const rowBadgeVariant = calculationStatusBadgeVariant(order.rowStatus);
  const rowLabel = calculationStatusLabel(order.rowStatus);

  const returnBreakdown = order.returnBreakdown;

  return (
    <>
      <tr
        className={cn(rowColor, "cursor-pointer group align-middle")}
        title={order.warnings?.length ? order.warnings.join("\n") : undefined}
        onClick={onToggle}
      >
        <td className="w-8 px-2 py-2 text-center">
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 mx-auto text-slate-400 transition-transform",
              expanded && "rotate-180 text-slate-700",
            )}
          />
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {formatDate(order.orderDate)}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-slate-700">
          {order.subOrderNo || "—"}
        </td>
        <td
          className="px-3 py-2 max-w-[220px] truncate text-slate-700"
          title={order.productName}
        >
          {order.productName || "—"}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-slate-800">
          {order.supplierSKU || "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
        <td className="px-3 py-2">{statusBadge}</td>
        <td
          className={cn(
            "px-3 py-2 text-right font-semibold tabular-nums",
            (order.finalSettlementAmount ?? 0) < 0
              ? "text-red-700"
              : "text-slate-800",
          )}
        >
          {formatINR(order.finalSettlementAmount)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
          {formatINR(order.actualPurchaseAmountPaid)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
          {formatINR(order.totalInputGST)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
          {formatINR(order.taxableCOGS)}
        </td>
        <td
          className={cn(
            "px-3 py-2 text-right tabular-nums font-semibold",
            profitClass,
          )}
        >
          {formatINR(order.cashProfitBeforeAds)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-500 italic">
          {order.estimatedAdAllocation ? (
            <span title="Estimated ad allocation">
              ~{formatINR(order.estimatedAdAllocation)}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td
          className={cn(
            "px-3 py-2 text-right tabular-nums font-semibold",
            netClass,
          )}
        >
          {formatINR(order.netProfit)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {order.marginPercent !== null && order.marginPercent !== undefined ? (
            <span
              className={
                order.marginPercent >= 0 ? "text-emerald-700" : "text-red-700"
              }
            >
              {formatNumber(order.marginPercent, 1)}%
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-center relative">
          <div className="flex flex-col items-center gap-1">
            <Badge variant={rowBadgeVariant}>{rowLabel}</Badge>
            {order.warnings && order.warnings.length > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-blue-700"
                title={order.warnings.join("\n")}
              >
                <AlertTriangle className="w-3 h-3" />
                {order.warnings.length}
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/80" onClick={(e) => e.stopPropagation()}>
          <td colSpan={16} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-slate-600" />
                    Why this profit?
                  </h4>
                </div>
                <BreakdownRow
                  label="Final Settlement Amount"
                  value={order.finalSettlementAmount}
                  note="From Meesho report (after all fees, commissions, and charges)"
                />
                <BreakdownRow
                  label={`Purchase Cost Incl GST (Qty × Unit)`}
                  value={
                    order.purchaseCostPerUnit !== null
                      ? order.quantity * order.purchaseCostPerUnit
                      : null
                  }
                  note={
                    order.purchaseCostPerUnit !== null
                      ? `${order.quantity} × ${formatINR(order.purchaseCostPerUnit)}`
                      : "Missing SKU cost — enter in SKU Costs page"
                  }
                  negative
                />
                {order.liveOrderStatus === "Returned" && returnBreakdown && (
                  <>
                    <div className="border-t border-slate-200 my-1.5" />
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-1.5 rounded-md">
                      <Package className="w-3.5 h-3.5" /> Customer Return
                      Breakdown
                    </div>
                    <BreakdownRow
                      label={
                        returnBreakdown.effectiveCondition === "usable"
                          ? "Product Condition: Returned & Usable"
                          : "Product Condition: Damaged / Lost"
                      }
                      value={null}
                      note={
                        returnBreakdown.isManualOverride
                          ? "Per-order override"
                          : "From global Return setting"
                      }
                      highlight={
                        returnBreakdown.effectiveCondition === "damaged"
                          ? "bad"
                          : "good"
                      }
                    />
                    {returnBreakdown.effectiveCondition === "usable" && (
                      <BreakdownRow
                        label="Inventory recovered — Purchase Cost NOT deducted"
                        value={null}
                        note="Product returned to stock in usable condition"
                        highlight="good"
                      />
                    )}
                    {returnBreakdown.effectiveCondition === "damaged" && (
                      <BreakdownRow
                        label="Purchase Cost lost (Damaged/Lost)"
                        value={returnBreakdown.purchaseCostLoss}
                        note="Treated as COGS loss"
                        negative
                        highlight="bad"
                      />
                    )}
                    <BreakdownRow
                      label="Return Shipping Charge (Incl. GST, from report)"
                      value={returnBreakdown.returnShippingCharge}
                      note={
                        returnBreakdown.returnShippingCharge === 0
                          ? "₹0 — No actual return shipping charged in report"
                          : "Actual charge from Meesho Excel report"
                      }
                      negative
                    />
                    <BreakdownRow
                      label="Total Return Loss"
                      value={returnBreakdown.totalReturnLoss}
                      note="= Shipping Loss + Purchase Loss (if any)"
                      negative
                      highlight="bad"
                      strong
                    />
                  </>
                )}
                <div className="border-t border-slate-300" />
                <BreakdownRow
                  label="Cash Profit Before Ads"
                  value={order.cashProfitBeforeAds}
                  note="= Settlement − Purchase (adjusted for returns/RTO)"
                  strong
                  highlight={
                    order.cashProfitBeforeAds === null
                      ? undefined
                      : order.cashProfitBeforeAds >= 0
                        ? "good"
                        : "bad"
                  }
                />
                {order.estimatedAdAllocation ? (
                  <BreakdownRow
                    label="Estimated Ad Allocation"
                    value={order.estimatedAdAllocation}
                    note="Spread across orders based on your ad allocation method"
                    negative
                  />
                ) : null}
                <BreakdownRow
                  label="Net Cash Profit"
                  value={order.netProfit}
                  note="= Cash Profit Before Ads − Ads"
                  strong
                  highlight={
                    order.netProfit === null
                      ? undefined
                      : order.netProfit >= 0
                        ? "good"
                        : "bad"
                  }
                />
                {order.hasMissingCost && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      <strong>Warning:</strong> SKU purchase cost is missing.
                      Profit values above may be incomplete.
                    </span>
                  </div>
                )}
              </div>

              {order.liveOrderStatus === "Returned" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                      <Save className="w-4 h-4 text-blue-600" />
                      Return Product Condition
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">
                      Override the global setting for this specific returned
                      order.
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          v: "usable" as PerOrderReturnCondition,
                          label: "Returned & Usable",
                          desc: "Product back in stock — only shipping loss",
                          Icon: CheckCircle2,
                          iconColor: "text-emerald-600",
                        },
                        {
                          v: "damaged" as PerOrderReturnCondition,
                          label: "Damaged / Lost",
                          desc: "Full product cost + shipping loss",
                          Icon: XCircle,
                          iconColor: "text-red-600",
                        },
                      ].map((opt) => {
                        const isActive =
                          returnBreakdown?.effectiveCondition === opt.v;
                        const isOverride =
                          returnBreakdown?.isManualOverride && isActive;
                        return (
                          <button
                            key={opt.v}
                            onClick={() =>
                              setReturnOverride(order.subOrderNo, opt.v)
                            }
                            className={cn(
                              "w-full text-left p-2.5 rounded-md border flex items-start gap-2.5 transition-colors",
                              isActive && isOverride
                                ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-200"
                                : isActive
                                  ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                                  : "border-slate-200 hover:bg-slate-50",
                            )}
                          >
                            <opt.Icon
                              className={cn(
                                "w-4.5 h-4.5 mt-0.5 shrink-0 w-5 h-5",
                                opt.iconColor,
                              )}
                            />
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                {opt.label}
                                {isOverride && (
                                  <Badge
                                    variant="info"
                                    className="text-[9px] h-4 px-1.5"
                                  >
                                    Override
                                  </Badge>
                                )}
                                {isActive && !isOverride && (
                                  <Badge
                                    variant="muted"
                                    className="text-[9px] h-4 px-1.5"
                                  >
                                    Global
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {opt.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {returnBreakdown?.isManualOverride && (
                      <button
                        onClick={() =>
                          setReturnOverride(order.subOrderNo, null)
                        }
                        className="mt-2.5 text-[11px] text-slate-500 hover:text-slate-700 underline underline-offset-2"
                      >
                        ← Revert to global Return setting
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 bg-slate-100/70 border border-slate-200 rounded-md px-2.5 py-2">
                    <strong className="text-slate-700">Note:</strong> The
                    condition you choose here directly affects whether Purchase
                    Cost is deducted and how profit is calculated for this
                    order. Updates apply instantly across all reports.
                  </div>
                </div>
              )}

              {order.liveOrderStatus !== "Returned" && (
                <div className="space-y-2.5">
                  <h4 className="text-sm font-bold text-slate-800">
                    Order Details
                  </h4>
                  <div className="bg-white rounded-lg border border-slate-200 p-3.5 text-xs space-y-1.5">
                    <DetailLine
                      label="Sub Order No"
                      value={order.subOrderNo || "—"}
                      mono
                    />
                    <DetailLine
                      label="Raw Status (from report)"
                      value={order.rawStatus || "—"}
                    />
                    <DetailLine
                      label="Dispatch Date"
                      value={formatDate(order.dispatchDate)}
                    />
                    <DetailLine
                      label="Total Sale Amount (list)"
                      value={formatINR(order.totalSaleAmount)}
                    />
                    {order.totalSaleReturnAmount ? (
                      <DetailLine
                        label="Sale Return Amount"
                        value={formatINR(order.totalSaleReturnAmount)}
                      />
                    ) : null}
                    <DetailLine
                      label="Output GST"
                      value={
                        order.outputGST !== null
                          ? `${formatINR(order.outputGST)}${order.outputGSTEstimated ? " (estimated)" : " (from report)"}`
                          : "—"
                      }
                    />
                    {order.netGSTPayable !== null && (
                      <DetailLine
                        label="Net GST Payable (est.)"
                        value={formatINR(order.netGSTPayable)}
                      />
                    )}
                    {order.gstAdjustedProfit !== null && (
                      <DetailLine
                        label="GST Adjusted Profit"
                        value={formatINR(order.gstAdjustedProfit)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BreakdownRow({
  label,
  value,
  note,
  negative,
  highlight,
  strong,
}: {
  label: string;
  value: number | null | undefined | string;
  note?: string;
  negative?: boolean;
  highlight?: "good" | "bad";
  strong?: boolean;
}) {
  const displayValue =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? "—"
        : negative
          ? `− ${formatINR(Math.abs(value as number))}`
          : formatINR(value as number);
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-slate-700",
            strong && "font-semibold text-slate-900",
          )}
        >
          {label}
        </div>
        {note && (
          <div className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
            {note}
          </div>
        )}
      </div>
      <div
        className={cn(
          "tabular-nums shrink-0 text-right",
          strong && "font-bold",
          highlight === "good" && "text-emerald-700",
          highlight === "bad" && "text-red-700",
          negative && !highlight && "text-red-600",
        )}
      >
        {displayValue}
      </div>
    </div>
  );
}

function DetailLine({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={cn(
          "text-slate-800 truncate text-right",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
