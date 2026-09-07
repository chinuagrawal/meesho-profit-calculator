import { useMemo } from "react";
import { FileText, IndianRupee, Calendar } from "lucide-react";
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
} from "recharts";

export default function ReferralPage() {
  const { referrals } = useApp();

  const totals = useMemo(() => {
    const total = referrals.reduce((s, r) => s + (r.amount ?? 0), 0);
    const count = referrals.length;
    const withOrder = referrals.filter((r) => r.subOrderNo).length;
    return { total, count, withOrder };
  }, [referrals]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { label: string; amount: number; count: number }>();
    for (const r of referrals) {
      if (!r.date) continue;
      const mk = getMonthKey(r.date);
      const label = formatMonthYear(r.date);
      const prev = m.get(mk);
      m.set(mk, {
        label,
        amount: (prev?.amount ?? 0) + (r.amount ?? 0),
        count: (prev?.count ?? 0) + 1,
      });
    }
    return Array.from(m.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [referrals]);

  const byReason = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of referrals) {
      const key = r.reason || "(no reason)";
      m.set(key, (m.get(key) ?? 0) + (r.amount ?? 0));
    }
    return Array.from(m.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15);
  }, [referrals]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-600" />
          Referral Payments
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Income recorded on the <Badge variant="info" className="mx-1">Referral Payments</Badge> sheet.
          Only attached to specific orders when Sub Order No is available; otherwise
          treated as additional overall income in Dashboard totals.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          title="Total Referral Income"
          value={formatINR(totals.total)}
          tone="good"
          icon={IndianRupee}
        />
        <KPI
          title="Number of Payments"
          value={totals.count.toString()}
          tone="info"
          icon={FileText}
        />
        <KPI
          title="Avg. Payment"
          value={
            totals.count > 0
              ? formatINR(totals.total / totals.count)
              : "—"
          }
          tone="default"
          icon={IndianRupee}
        />
        <KPI
          title="Linked to Order"
          value={`${totals.withOrder} / ${totals.count}`}
          tone="default"
          icon={Calendar}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral Income by Month</CardTitle>
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
                    <Bar
                      dataKey="amount"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      name="Income"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Reason</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byReason.length === 0 ? (
              <EmptyChart compact />
            ) : (
              byReason.map((r) => {
                const max = Math.max(...byReason.map((x) => x.amount), 1);
                const pct = (r.amount / max) * 100;
                return (
                  <div key={r.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 truncate max-w-[60%]">
                        {r.name}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatINR(r.amount)}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Referral Entries ({referrals.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b">
              <tr>
                <th className="text-left font-semibold px-3 py-2.5">Date</th>
                <th className="text-left font-semibold px-3 py-2.5">Reason</th>
                <th className="text-left font-semibold px-3 py-2.5">
                  Linked Sub Order No
                </th>
                <th className="text-right font-semibold px-3 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-12 text-slate-500 text-sm"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    No referral payments. Upload a Meesho report with a Referral
                    Payments sheet.
                  </td>
                </tr>
              ) : (
                referrals.slice(0, 500).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.reason || (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.subOrderNo || (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {formatINR(r.amount)}
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
  tone,
}: {
  title: string;
  value: string;
  icon: any;
  tone: "default" | "good" | "warn" | "info";
}) {
  const tones = {
    default: "from-slate-500 to-slate-700",
    good: "from-emerald-500 to-teal-600",
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

function EmptyChart({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        "w-full flex flex-col items-center justify-center text-slate-400 text-sm " +
        (compact ? "py-12" : "h-full")
      }
    >
      <FileText className="w-10 h-10 mb-2 opacity-40" />
      No referral data yet
    </div>
  );
}
