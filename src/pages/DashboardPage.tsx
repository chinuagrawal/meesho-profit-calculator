import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Megaphone,
  Tag,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Upload,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Alert,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import {
  formatINR,
  formatPercent,
  formatNumber,
  formatDate,
  getMonthKey,
  formatMonthYear,
} from "@/lib/utils";
import { aggregateBySKU, aggregateByMonth } from "@/calculations";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { SKUAggregate, MonthlyAggregate } from "@/types";

function Kpi({
  title,
  value,
  icon: Icon,
  tone = "default",
  subtitle,
  footer,
}: {
  title: string;
  value: string;
  icon: any;
  tone?: "default" | "good" | "bad" | "warn" | "info" | "muted";
  subtitle?: string;
  footer?: React.ReactNode;
}) {
  const tones = {
    default: "from-slate-500 to-slate-700",
    good: "from-emerald-500 to-teal-600",
    bad: "from-red-500 to-rose-600",
    warn: "from-yellow-500 to-amber-600",
    info: "from-blue-500 to-indigo-600",
    muted: "from-slate-400 to-slate-600",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {title}
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums break-words">
              {value}
            </div>
            {subtitle && (
              <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
            )}
            {footer}
          </div>
          <div
            className={`shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center shadow-sm`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#10b981",
  Shipped: "#3b82f6",
  Returned: "#f59e0b",
  RTO: "#ef4444",
  Cancelled: "#94a3b8",
  Other: "#64748b",
};

function MonthRow({
  label,
  values,
  format,
  isMoney = false,
  isPercent = false,
  toneByValue = false,
}: {
  label: string;
  values: number[];
  format: (v: number) => string;
  isMoney?: boolean;
  isPercent?: boolean;
  toneByValue?: boolean;
}) {
  const n = values.length;
  const changeVal =
    n >= 2 && values[n - 2] !== 0
      ? ((values[n - 1] - values[n - 2]) / Math.abs(values[n - 2])) * 100
      : null;
  const tone = (v: number) =>
    toneByValue
      ? v > 0
        ? "text-emerald-600"
        : v < 0
          ? "text-red-600"
          : "text-slate-700"
      : "text-slate-700";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-3 font-medium text-slate-700">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-right tabular-nums font-medium ${tone(v)}`}
        >
          {format(v)}
        </td>
      ))}
      {n >= 2 && (
        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
          {changeVal === null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span
              className={
                changeVal >= 0
                  ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold"
                  : "text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-semibold"
              }
            >
              {changeVal >= 0 ? "▲" : "▼"} {Math.abs(changeVal).toFixed(1)}
              {!isMoney && !isPercent ? "%" : isPercent ? " pts" : ""}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    enrichedOrders,
    ads,
    referrals,
    compensations,
    skuCosts,
    userSettings,
  } = useApp();

  const totals = useMemo(() => {
    const nonCancelled = enrichedOrders.filter(
      (o) => o.liveOrderStatus !== "Cancelled",
    );
    const totalOrders = enrichedOrders.length;
    const unitsSold = nonCancelled.reduce((s, o) => s + (o.quantity ?? 0), 0);
    const totalSales = enrichedOrders.reduce(
      (s, o) => s + (o.totalSaleAmount ?? 0),
      0,
    );
    const totalSettlement = enrichedOrders.reduce(
      (s, o) => s + (o.finalSettlementAmount ?? 0),
      0,
    );
    const totalPurchaseCost = enrichedOrders.reduce(
      (s, o) => s + (o.actualPurchaseAmountPaid ?? 0),
      0,
    );
    const totalCOGS = enrichedOrders.reduce(
      (s, o) => s + (o.taxableCOGS ?? o.actualPurchaseAmountPaid ?? 0),
      0,
    );
    const grossCashProfit = enrichedOrders.reduce(
      (s, o) => s + (o.basicCashProfit ?? 0),
      0,
    );
    const adSpend = ads.reduce(
      (s, a) => s + (a.totalAdsCost ?? a.adCost ?? 0),
      0,
    );
    const netProfit = enrichedOrders.reduce(
      (s, o) => s + (o.netProfit ?? 0),
      0,
    );
    const settlementForMargin = nonCancelled.reduce(
      (s, o) => s + (o.finalSettlementAmount ?? 0),
      0,
    );
    const profitForMargin = nonCancelled.reduce(
      (s, o) => s + (o.basicCashProfit ?? 0),
      0,
    );
    const profitMargin =
      settlementForMargin > 0
        ? (profitForMargin / settlementForMargin) * 100
        : null;

    const returns = enrichedOrders.filter(
      (o) => o.liveOrderStatus === "Returned",
    ).length;
    const rto = enrichedOrders.filter(
      (o) => o.liveOrderStatus === "RTO",
    ).length;
    const cancellations = enrichedOrders.filter(
      (o) => o.liveOrderStatus === "Cancelled",
    ).length;
    const delivered = enrichedOrders.filter(
      (o) => o.liveOrderStatus === "Delivered",
    ).length;
    const shipped = enrichedOrders.filter(
      (o) => o.liveOrderStatus === "Shipped",
    ).length;
    const successful = delivered + shipped;
    const returnRate = successful > 0 ? (returns / successful) * 100 : null;
    const rtoRate = successful > 0 ? (rto / successful) * 100 : null;

    const missingCosts = skuCosts.filter(
      (s) =>
        s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
    ).length;
    const uniqueSKUs = new Set(
      enrichedOrders.map((o) => o.supplierSKU).filter(Boolean),
    ).size;

    const totalLoss = enrichedOrders.reduce((s, o) => {
      if (o.netProfit !== null && o.netProfit < 0)
        return s + Math.abs(o.netProfit);
      return s;
    }, 0);

    const negativeSettlements = enrichedOrders.filter(
      (o) =>
        o.finalSettlementAmount !== null &&
        o.finalSettlementAmount !== undefined &&
        o.finalSettlementAmount < 0,
    ).length;

    const cancelledWithSettlement = enrichedOrders.filter(
      (o) =>
        o.liveOrderStatus === "Cancelled" &&
        o.finalSettlementAmount !== null &&
        o.finalSettlementAmount > 0,
    ).length;

    const reviewRequired = enrichedOrders.filter(
      (o) => o.rowStatus === "REVIEW_REQUIRED",
    ).length;

    const outputGSTTotal = enrichedOrders.reduce(
      (s, o) => s + (o.outputGST ?? 0),
      0,
    );
    const inputGSTTotal = enrichedOrders.reduce(
      (s, o) => s + (o.totalInputGST ?? 0),
      0,
    );
    const netGSTPayable = enrichedOrders.reduce(
      (s, o) => s + (o.netGSTPayable ?? 0),
      0,
    );

    return {
      totalOrders,
      unitsSold,
      totalSales,
      totalSettlement,
      totalPurchaseCost,
      totalCOGS,
      grossCashProfit,
      adSpend,
      netProfit,
      profitMargin,
      returnRate,
      rtoRate,
      missingCosts,
      uniqueSKUs,
      returns,
      rto,
      cancellations,
      delivered,
      shipped,
      successful,
      totalLoss,
      negativeSettlements,
      cancelledWithSettlement,
      reviewRequired,
      outputGSTTotal,
      inputGSTTotal,
      netGSTPayable,
    };
  }, [enrichedOrders, ads, skuCosts]);

  const skuAggs: SKUAggregate[] = useMemo(
    () => aggregateBySKU(enrichedOrders),
    [enrichedOrders],
  );
  const monthlyAggs: MonthlyAggregate[] = useMemo(
    () => aggregateByMonth(enrichedOrders, ads),
    [enrichedOrders, ads],
  );

  const settlementVsCogsChart = useMemo(() => {
    if (monthlyAggs.length === 0) return [];
    return monthlyAggs.map((m) => ({
      month: m.monthLabel,
      Settlement: m.settlement,
      COGS: m.cogs ?? 0,
    }));
  }, [monthlyAggs]);

  const profitOverTime = useMemo(() => {
    if (monthlyAggs.length === 0) return [];
    return monthlyAggs.map((m) => ({
      month: m.monthLabel,
      Profit: m.profit ?? 0,
    }));
  }, [monthlyAggs]);

  const topProfitSKUs = useMemo(() => {
    return skuAggs
      .filter((s) => s.profit !== null && !s.hasMissingCost)
      .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
      .slice(0, 10)
      .map((s) => ({
        SKU: s.supplierSKU.slice(0, 14),
        Profit: s.profit ?? 0,
      }));
  }, [skuAggs]);

  const topLossSKUs = useMemo(() => {
    return skuAggs
      .filter((s) => s.profit !== null && !s.hasMissingCost)
      .sort((a, b) => (a.profit ?? 0) - (b.profit ?? 0))
      .slice(0, 10)
      .filter((s) => (s.profit ?? 0) < 0)
      .map((s) => ({
        SKU: s.supplierSKU.slice(0, 14),
        Loss: Math.abs(s.profit ?? 0),
      }));
  }, [skuAggs]);

  const salesBySKU = useMemo(() => {
    return skuAggs
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)
      .map((s) => ({
        SKU: s.supplierSKU.slice(0, 14),
        Sales: s.sales,
      }));
  }, [skuAggs]);

  const adSpendByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const ad of ads) {
      if (!ad.deductionDate) continue;
      const key = getMonthKey(ad.deductionDate);
      const label = formatMonthYear(ad.deductionDate);
      const cost = ad.totalAdsCost ?? ad.adCost ?? 0;
      m.set(label, (m.get(label) ?? 0) + cost);
      void key;
    }
    return Array.from(m.entries()).map(([month, spend]) => ({ month, spend }));
  }, [ads]);

  const orderStatusDist = useMemo(() => {
    const dist = {
      Delivered: 0,
      Shipped: 0,
      Returned: 0,
      RTO: 0,
      Cancelled: 0,
      Other: 0,
    } as Record<string, number>;
    for (const o of enrichedOrders) {
      dist[o.liveOrderStatus] = (dist[o.liveOrderStatus] ?? 0) + 1;
    }
    return Object.entries(dist)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [enrichedOrders]);

  const returnRTORate = useMemo(() => {
    if (monthlyAggs.length === 0) return [];
    return monthlyAggs.map((m) => {
      const base =
        m.orders - m.cancellations > 0 ? m.orders - m.cancellations : 1;
      return {
        month: m.monthLabel,
        "Return Rate %": (m.returns / base) * 100 || 0,
        "RTO Rate %": (m.rto / base) * 100 || 0,
      };
    });
  }, [monthlyAggs]);

  const referralTotal = referrals.reduce((s, r) => s + (r.amount ?? 0), 0);
  const compensationTotal = compensations.reduce(
    (s, c) => s + (c.compensationAmount ?? 0),
    0,
  );
  const recoveryTotal = compensations.reduce(
    (s, c) => s + (c.recoveryAmount ?? 0),
    0,
  );
  const netCompRec = compensationTotal - recoveryTotal;

  if (enrichedOrders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <Card className="p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Welcome to Meesho Profit Calculator
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto mb-6">
            Get accurate profit calculations by uploading your actual Meesho
            payment report. We'll parse the Order Payments, Ads, Referrals and
            Compensation sheets, then calculate COGS, cash profit, net profit
            and margins per order & SKU.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate("/import")}
            >
              <Upload className="w-4 h-4" /> Upload Meesho Report
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/sku-costs")}
            >
              <Tag className="w-4 h-4" /> Set Up SKU Costs
            </Button>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              t: "1. Upload Report",
              d: "Drag & drop your Meesho Excel. Everything runs locally in your browser.",
              i: Upload,
            },
            {
              t: "2. Enter SKU Costs",
              d: "Type purchase price INCLUDING GST. GST split + ITC calculated automatically.",
              i: IndianRupee,
            },
            {
              t: "3. Analyze Profit",
              d: "See cash profit, accounting profit, net profit, SKU analysis, and exports.",
              i: TrendingUp,
            },
          ].map((s) => (
            <Card key={s.t}>
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mb-3">
                  <s.i className="w-5 h-5" />
                </div>
                <div className="font-semibold text-slate-900">{s.t}</div>
                <div className="text-xs text-slate-500 mt-1">{s.d}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-emerald-600" />
            Dashboard
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Profitability summary · based on {enrichedOrders.length} orders · Ad
            allocation:{" "}
            <Badge variant="info" className="ml-1">
              {userSettings.adAllocationMethod}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/orders")}
          >
            <ShoppingBag className="w-4 h-4" /> View Orders
          </Button>
          {totals.missingCosts > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/sku-costs?filter=missing")}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-200" />
              Fix {totals.missingCosts} Missing Costs
            </Button>
          )}
        </div>
      </div>

      {totals.missingCosts > 0 && (
        <Alert variant="warning" className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong>
              {totals.missingCosts} SKU{totals.missingCosts !== 1 ? "s" : ""}
            </strong>{" "}
            don't have a purchase cost yet. Profit is shown as "—" for those
            until you add one.{" "}
            <Link
              to="/sku-costs?filter=missing"
              className="underline font-medium"
            >
              Enter costs →
            </Link>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Kpi
          title="Total Orders"
          value={totals.totalOrders.toLocaleString("en-IN")}
          icon={ShoppingBag}
          tone="info"
          subtitle={`${totals.uniqueSKUs} unique SKUs`}
        />
        <Kpi
          title="Delivered Orders"
          value={totals.delivered.toLocaleString("en-IN")}
          icon={ShoppingBag}
          tone="good"
          subtitle={`+${totals.shipped} shipped`}
        />
        <Kpi
          title="RTO Orders"
          value={totals.rto.toLocaleString("en-IN")}
          icon={RotateCcw}
          tone={
            totals.rto === 0
              ? "muted"
              : totals.rtoRate && totals.rtoRate > 10
                ? "bad"
                : "warn"
          }
          footer={
            totals.rtoRate !== null ? (
              <div className="mt-1 text-[11px] text-slate-500">
                Rate: {formatNumber(totals.rtoRate, 1)}%
              </div>
            ) : undefined
          }
        />
        <Kpi
          title="Cancelled Orders"
          value={totals.cancellations.toLocaleString("en-IN")}
          icon={ShoppingBag}
          tone="muted"
          subtitle={`${totals.returns} returns`}
        />
        <Kpi
          title="Total Settlement"
          value={formatINR(totals.totalSettlement)}
          icon={IndianRupee}
          tone="info"
        />
        <Kpi
          title="Total Purchase Cost"
          value={formatINR(totals.totalPurchaseCost)}
          icon={IndianRupee}
          tone="muted"
        />
        <Kpi
          title="Total Ad Cost"
          value={formatINR(totals.adSpend)}
          icon={Megaphone}
          tone="warn"
          subtitle={`${ads.length} ad entries`}
        />
        <Kpi
          title="Net Cash Profit"
          value={formatINR(totals.netProfit + referralTotal + netCompRec)}
          icon={
            totals.netProfit + referralTotal + netCompRec >= 0
              ? TrendingUp
              : TrendingDown
          }
          tone={
            totals.netProfit + referralTotal + netCompRec >= 0 ? "good" : "bad"
          }
          subtitle={
            totals.profitMargin !== null
              ? `Margin: ${formatNumber(totals.profitMargin, 2)}%`
              : undefined
          }
        />
        <Kpi
          title="Profit Margin"
          value={
            totals.profitMargin !== null
              ? formatPercent(totals.profitMargin, 2)
              : "—"
          }
          icon={TrendingUp}
          tone={
            totals.profitMargin === null
              ? "muted"
              : totals.profitMargin >= 0
                ? "good"
                : "bad"
          }
        />
        <Kpi
          title="Total Loss"
          value={formatINR(totals.totalLoss)}
          icon={TrendingDown}
          tone={totals.totalLoss > 0 ? "bad" : "muted"}
          subtitle="Sum of absolute losses"
        />
        <Kpi
          title="Units Sold"
          value={totals.unitsSold.toLocaleString("en-IN")}
          icon={Package}
          tone="default"
          subtitle={`${totals.successful} delivered`}
        />
        <Kpi
          title="Missing SKU Costs"
          value={totals.missingCosts.toLocaleString("en-IN")}
          icon={AlertTriangle}
          tone={
            totals.missingCosts === 0
              ? "good"
              : totals.missingCosts > 5
                ? "bad"
                : "warn"
          }
          subtitle={`of ${totals.uniqueSKUs} unique SKUs`}
          footer={
            totals.missingCosts > 0 ? (
              <Link
                to="/sku-costs?filter=missing"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-yellow-700 hover:text-yellow-800 underline"
              >
                Fix costs →
              </Link>
            ) : undefined
          }
        />
      </div>

      {(totals.outputGSTTotal > 0 || totals.inputGSTTotal > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Kpi
            title="Output GST (Sales)"
            value={formatINR(totals.outputGSTTotal)}
            icon={IndianRupee}
            tone="info"
            subtitle="From settlement / estimated"
          />
          <Kpi
            title="Input GST / ITC"
            value={formatINR(totals.inputGSTTotal)}
            icon={IndianRupee}
            tone="good"
            subtitle="Purchase-side GST"
          />
          <Kpi
            title="Est. Net GST Payable"
            value={formatINR(totals.netGSTPayable)}
            icon={AlertTriangle}
            tone={
              totals.netGSTPayable > 0
                ? "warn"
                : totals.netGSTPayable < 0
                  ? "good"
                  : "muted"
            }
            subtitle={
              totals.netGSTPayable < 0
                ? "Refund / carry-forward"
                : "Before credits/adjustments"
            }
          />
        </div>
      )}

      {(totals.negativeSettlements > 0 ||
        totals.cancelledWithSettlement > 0 ||
        totals.reviewRequired > 0 ||
        totals.missingCosts > 0) && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {totals.missingCosts > 0 && (
            <Alert variant="warning" className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold mb-0.5">Missing SKU Costs</div>
                <div className="text-xs">
                  <Link to="/sku-costs?filter=missing" className="underline">
                    {totals.missingCosts} SKU
                    {totals.missingCosts !== 1 ? "s" : ""}
                  </Link>{" "}
                  without purchase cost — profit not calculable.
                </div>
              </div>
            </Alert>
          )}
          {totals.negativeSettlements > 0 && (
            <Alert variant="danger" className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold mb-0.5">Negative Settlements</div>
                <div className="text-xs">
                  {totals.negativeSettlements} order
                  {totals.negativeSettlements !== 1 ? "s" : ""} with debit /
                  negative settlement from Meesho.
                </div>
              </div>
            </Alert>
          )}
          {totals.cancelledWithSettlement > 0 && (
            <Alert variant="info" className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold mb-0.5">
                  Cancelled with Settlement
                </div>
                <div className="text-xs">
                  {totals.cancelledWithSettlement} cancelled order
                  {totals.cancelledWithSettlement !== 1 ? "s" : ""} still have a
                  settlement amount — manual review recommended.
                </div>
              </div>
            </Alert>
          )}
          {totals.reviewRequired > 0 && (
            <Alert variant="info" className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold mb-0.5">Orders Need Review</div>
                <div className="text-xs">
                  <Link to="/orders" className="underline">
                    {totals.reviewRequired} order
                    {totals.reviewRequired !== 1 ? "s" : ""}
                  </Link>{" "}
                  flagged as REVIEW REQUIRED — check details.
                </div>
              </div>
            </Alert>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Profit Is Calculated</CardTitle>
          <CardDescription>
            Meesho fees are shown in the settlement already — we do NOT subtract
            them again.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="font-semibold text-emerald-800 mb-1">
              Basic Cash Profit
            </div>
            <div className="text-emerald-700/90 font-mono text-xs">
              Meesho Final Settlement − Actual Purchase Cost (Incl. GST)
            </div>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="font-semibold text-blue-800 mb-1">Net Profit</div>
            <div className="text-blue-700/90 font-mono text-xs">
              Basic Cash Profit − Estimated Ad Cost + Referrals + (Compensation
              − Recovery)
            </div>
          </div>
        </CardContent>
      </Card>

      {monthlyAggs.length >= 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Monthly Comparison
            </CardTitle>
            <CardDescription>
              Compare performance across months. Upload multiple monthly reports
              to see side-by-side.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3 w-36">
                      Metric
                    </th>
                    {monthlyAggs.map((m) => (
                      <th
                        key={m.monthKey}
                        className="text-right font-semibold px-4 py-3 whitespace-nowrap"
                      >
                        {m.monthLabel}
                      </th>
                    ))}
                    {monthlyAggs.length >= 2 && (
                      <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                        Δ vs Previous
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <MonthRow
                    label="Orders"
                    values={monthlyAggs.map((m) => m.orders)}
                    format={(v) => v.toLocaleString("en-IN")}
                    isPercent={false}
                  />
                  <MonthRow
                    label="Units Sold"
                    values={monthlyAggs.map((m) => m.units)}
                    format={(v) => v.toLocaleString("en-IN")}
                    isPercent={false}
                  />
                  <MonthRow
                    label="Sales"
                    values={monthlyAggs.map((m) => m.sales)}
                    format={(v) => formatINR(v)}
                    isMoney
                  />
                  <MonthRow
                    label="Settlement"
                    values={monthlyAggs.map((m) => m.settlement)}
                    format={(v) => formatINR(v)}
                    isMoney
                  />
                  <MonthRow
                    label="COGS"
                    values={monthlyAggs.map((m) => m.cogs ?? 0)}
                    format={(v) => formatINR(v)}
                    isMoney
                  />
                  <MonthRow
                    label="Ad Spend"
                    values={monthlyAggs.map((m) => m.adSpend)}
                    format={(v) => formatINR(v)}
                    isMoney
                  />
                  <MonthRow
                    label="Profit"
                    values={monthlyAggs.map((m) => m.profit ?? 0)}
                    format={(v) => formatINR(v)}
                    isMoney
                    toneByValue
                  />
                  <MonthRow
                    label="Margin %"
                    values={monthlyAggs.map((m) => m.margin ?? 0)}
                    format={(v) => formatPercent(v, 1)}
                    isPercent
                    toneByValue
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Settlement vs COGS (Monthly)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {settlementVsCogsChart.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={settlementVsCogsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend />
                    <Bar
                      dataKey="Settlement"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="COGS" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {profitOverTime.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitOverTime}>
                    <defs>
                      <linearGradient
                        id="profitGrad"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10b981"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#profitGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top 10 Profitable SKUs</CardTitle>
            <Link
              to="/sku-analysis"
              className="text-xs text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5"
            >
              All SKUs <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {topProfitSKUs.length === 0 ? (
                <EmptyChart msg="No SKUs with profit data yet (add purchase costs)." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProfitSKUs} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="SKU"
                      tick={{ fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="Profit"
                      fill="#10b981"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Loss-Making SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {topLossSKUs.length === 0 ? (
                <EmptyChart msg="No loss-making SKUs identified yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLossSKUs} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="SKU"
                      tick={{ fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip
                      formatter={(v: number) => `−${formatINR(v)}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="Loss" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales by SKU (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {salesBySKU.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesBySKU}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="SKU"
                      tick={{ fontSize: 9 }}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="Sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ad Spend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {adSpendByDate.length === 0 ? (
                <EmptyChart msg="No Ads Cost data found — upload a report with Ads Cost sheet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={adSpendByDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Ad Spend"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Order Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {orderStatusDist.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {orderStatusDist.map((e) => (
                        <Cell
                          key={e.name}
                          fill={STATUS_COLORS[e.name] ?? "#64748b"}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Return / RTO Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {returnRTORate.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={returnRTORate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Return Rate %"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="RTO Rate %"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({
  msg = "No data yet — upload a Meesho report first.",
}: {
  msg?: string;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
      <BarChart3 className="w-10 h-10 mb-2 opacity-40" />
      <div className="text-xs">{msg}</div>
    </div>
  );
}
