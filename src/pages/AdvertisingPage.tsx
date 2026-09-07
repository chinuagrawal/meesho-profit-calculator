import { useMemo } from "react";
import {
  Megaphone,
  TrendingUp,
  Calendar,
  Tag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import {
  formatDate,
  formatINR,
  getMonthKey,
  formatMonthYear,
} from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CAMP_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export default function AdvertisingPage() {
  const { ads, userSettings, setAdAllocationMethod } = useApp();

  const totals = useMemo(() => {
    const totalAdCost = ads.reduce(
      (s, a) => s + (a.adCost ?? 0),
      0
    );
    const totalCredits = ads.reduce(
      (s, a) => s + (a.credits ?? 0),
      0
    );
    const totalWaivers = ads.reduce(
      (s, a) => s + (a.waivers ?? 0),
      0
    );
    const totalDiscounts = ads.reduce(
      (s, a) => s + (a.discounts ?? 0),
      0
    );
    const totalGST = ads.reduce(
      (s, a) => s + (a.gst ?? 0),
      0
    );
    const totalNet = ads.reduce(
      (s, a) => s + (a.totalAdsCost ?? a.adCost ?? 0),
      0
    );
    const uniqueCampaigns = new Set(
      ads.map((a) => a.campaignID).filter(Boolean)
    ).size;
    const dates = ads
      .map((a) => a.deductionDate)
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
    const days = new Set(
      dates.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    ).size;
    const avgDaily = days > 0 ? totalNet / days : 0;
    return {
      totalAdCost,
      totalCredits,
      totalWaivers,
      totalDiscounts,
      totalGST,
      totalNet,
      uniqueCampaigns,
      days,
      avgDaily,
    };
  }, [ads]);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const ad of ads) {
      if (!ad.deductionDate) continue;
      const key = formatDate(ad.deductionDate);
      m.set(key, (m.get(key) ?? 0) + (ad.totalAdsCost ?? ad.adCost ?? 0));
    }
    return Array.from(m.entries())
      .map(([date, spend]) => ({ date, spend }))
      .slice(-30);
  }, [ads]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { label: string; spend: number }>();
    for (const ad of ads) {
      if (!ad.deductionDate) continue;
      const mk = getMonthKey(ad.deductionDate);
      const label = formatMonthYear(ad.deductionDate);
      const prev = m.get(mk)?.spend ?? 0;
      m.set(mk, {
        label,
        spend: prev + (ad.totalAdsCost ?? ad.adCost ?? 0),
      });
    }
    return Array.from(m.values());
  }, [ads]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const ad of ads) {
      const id = ad.campaignID || "(no campaign)";
      m.set(id, (m.get(id) ?? 0) + (ad.totalAdsCost ?? ad.adCost ?? 0));
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [ads]);

  const allocationOptions: {
    value: typeof userSettings.adAllocationMethod;
    label: string;
    desc: string;
  }[] = [
    {
      value: "none",
      label: "Do not include Ads",
      desc: "Net Profit = Basic Profit (ads shown separately only)",
    },
    {
      value: "equal",
      label: "Equal allocation across orders",
      desc: "Total ad cost divided equally across all non-cancelled orders",
    },
    {
      value: "byOrderValue",
      label: "Allocate by order value",
      desc: "Spread proportionally by Final Settlement amount",
    },
    {
      value: "byQuantity",
      label: "Allocate by quantity",
      desc: "Spread proportionally by units per order",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-amber-600" />
          Advertising
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Ads are read from the <Badge variant="info" className="mx-1">Ads Cost</Badge> sheet.
          Choose how ad costs are allocated to orders for Net Profit calculation.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI title="Total Ad Spend (Net)" value={formatINR(totals.totalNet)} tone="warn" icon={Megaphone} />
        <KPI title="Campaigns" value={totals.uniqueCampaigns.toString()} tone="info" icon={Tag} />
        <KPI title="Days Active" value={totals.days.toString()} tone="default" icon={Calendar} />
        <KPI
          title="Avg. Daily Spend"
          value={formatINR(totals.avgDaily)}
          tone="default"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad Cost Allocation Method</CardTitle>
          <CardDescription>
            Controls how ad spend is spread across orders. Allocated costs are
            shown as <em>Estimated Ad Allocation</em> per order.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {allocationOptions.map((opt) => (
            <label
              key={opt.value}
              className={
                "p-4 rounded-lg border cursor-pointer transition-all " +
                (userSettings.adAllocationMethod === opt.value
                  ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                  : "border-slate-200 bg-white hover:bg-slate-50")
              }
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={userSettings.adAllocationMethod === opt.value}
                  onChange={() => setAdAllocationMethod(opt.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {opt.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                </div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ad Spend by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {byMonth.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="spend" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Ad Spend" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ad Spend by Campaign (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {byCampaign.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCampaign}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      label={({ name, percent }) =>
                        `${(name || "None").slice(0, 12)} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {byCampaign.map((_, i) => (
                        <Cell key={i} fill={CAMP_COLORS[i % CAMP_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Ad Entries ({ads.length})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b">
              <tr>
                <th className="text-left font-semibold px-3 py-2.5">Date</th>
                <th className="text-left font-semibold px-3 py-2.5">Duration</th>
                <th className="text-left font-semibold px-3 py-2.5">Campaign</th>
                <th className="text-right font-semibold px-3 py-2.5">Ad Cost</th>
                <th className="text-right font-semibold px-3 py-2.5">Credits</th>
                <th className="text-right font-semibold px-3 py-2.5">Waivers</th>
                <th className="text-right font-semibold px-3 py-2.5">Discounts</th>
                <th className="text-right font-semibold px-3 py-2.5">GST</th>
                <th className="text-right font-semibold px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    No ad data. Upload a Meesho report with an Ads Cost sheet.
                  </td>
                </tr>
              ) : (
                ads.slice(0, 500).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(a.deductionDate)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {a.deductionDuration || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.campaignID || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatINR(a.adCost)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {a.credits ? formatINR(a.credits) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {a.waivers ? formatINR(a.waivers) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {a.discounts ? formatINR(a.discounts) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {a.gst ? formatINR(a.gst) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatINR(a.totalAdsCost ?? a.adCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KPI({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: any;
  tone?: "default" | "good" | "bad" | "warn" | "info";
}) {
  const tones = {
    default: "from-slate-500 to-slate-700",
    good: "from-emerald-500 to-teal-600",
    bad: "from-red-500 to-rose-600",
    warn: "from-yellow-500 to-amber-600",
    info: "from-blue-500 to-indigo-600",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {title}
            </div>
            <div className="mt-2 text-xl font-bold tabular-nums">{value}</div>
          </div>
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center shadow-sm`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm">
      <Megaphone className="w-10 h-10 mb-2 opacity-40" />
      No ad data yet
    </div>
  );
}
