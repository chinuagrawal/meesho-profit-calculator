import { useMemo } from "react";
import { RefreshCcw, Plus, Minus, IndianRupee } from "lucide-react";
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
  Legend,
} from "recharts";

export default function CompensationPage() {
  const { compensations } = useApp();

  const totals = useMemo(() => {
    const comp = compensations.reduce(
      (s, c) => s + (c.compensationAmount ?? 0),
      0
    );
    const recov = compensations.reduce(
      (s, c) => s + (c.recoveryAmount ?? 0),
      0
    );
    return {
      comp,
      recov,
      net: comp - recov,
      count: compensations.length,
    };
  }, [compensations]);

  const byMonth = useMemo(() => {
    const m = new Map<
      string,
      { label: string; comp: number; recov: number; net: number }
    >();
    for (const c of compensations) {
      if (!c.date) continue;
      const mk = getMonthKey(c.date);
      const label = formatMonthYear(c.date);
      const prev = m.get(mk);
      const compC = c.compensationAmount ?? 0;
      const recovC = c.recoveryAmount ?? 0;
      m.set(mk, {
        label,
        comp: (prev?.comp ?? 0) + compC,
        recov: (prev?.recov ?? 0) + recovC,
        net: (prev?.net ?? 0) + compC - recovC,
      });
    }
    return Array.from(m.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [compensations]);

  const byProgram = useMemo(() => {
    const m = new Map<
      string,
      { comp: number; recov: number; net: number; count: number }
    >();
    for (const c of compensations) {
      const key = c.program || c.reason || "(no program)";
      const prev = m.get(key);
      const compC = c.compensationAmount ?? 0;
      const recovC = c.recoveryAmount ?? 0;
      m.set(key, {
        comp: (prev?.comp ?? 0) + compC,
        recov: (prev?.recov ?? 0) + recovC,
        net: (prev?.net ?? 0) + compC - recovC,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 15);
  }, [compensations]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <RefreshCcw className="w-6 h-6 text-teal-600" />
          Compensation & Recovery
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Data read from the <Badge variant="info" className="mx-1">Compensation and Recovery</Badge> sheet.
          Only attached to individual orders when a reliable order id is present.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          title="Total Compensation"
          value={formatINR(totals.comp)}
          icon={Plus}
          tone="good"
        />
        <KPI
          title="Total Recovery"
          value={formatINR(totals.recov)}
          icon={Minus}
          tone="warn"
        />
        <KPI
          title="Net Compensation / Recovery"
          value={formatINR(totals.net)}
          icon={IndianRupee}
          tone={totals.net >= 0 ? "good" : "warn"}
        />
        <KPI
          title="Entries"
          value={totals.count.toString()}
          icon={RefreshCcw}
          tone="info"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Month</CardTitle>
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
                    <Legend />
                    <Bar
                      dataKey="comp"
                      fill="#14b8a6"
                      radius={[4, 4, 0, 0]}
                      name="Compensation"
                    />
                    <Bar
                      dataKey="recov"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                      name="Recovery"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Program / Reason</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left pb-2">Program</th>
                  <th className="text-right pb-2">Count</th>
                  <th className="text-right pb-2">Comp</th>
                  <th className="text-right pb-2">Recov</th>
                  <th className="text-right pb-2">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byProgram.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                      No data
                    </td>
                  </tr>
                ) : (
                  byProgram.map((r) => (
                    <tr key={r.name} className="hover:bg-slate-50">
                      <td className="py-2 pr-2 truncate max-w-[180px]">
                        {r.name}
                      </td>
                      <td className="py-2 text-right tabular-nums">{r.count}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-700">
                        {formatINR(r.comp)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-orange-700">
                        {formatINR(r.recov)}
                      </td>
                      <td
                        className={
                          "py-2 text-right tabular-nums font-semibold " +
                          (r.net >= 0 ? "text-emerald-700" : "text-red-700")
                        }
                      >
                        {formatINR(r.net)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Entries ({compensations.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b">
              <tr>
                <th className="text-left font-semibold px-3 py-2.5">Date</th>
                <th className="text-left font-semibold px-3 py-2.5">Program</th>
                <th className="text-left font-semibold px-3 py-2.5">Reason</th>
                <th className="text-left font-semibold px-3 py-2.5">Order</th>
                <th className="text-right font-semibold px-3 py-2.5">Comp</th>
                <th className="text-right font-semibold px-3 py-2.5">Recovery</th>
                <th className="text-right font-semibold px-3 py-2.5">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compensations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-slate-500 text-sm"
                  >
                    <RefreshCcw className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    No compensation / recovery data. Upload a Meesho report
                    with the Compensation and Recovery sheet.
                  </td>
                </tr>
              ) : (
                compensations.slice(0, 500).map((c) => {
                  const net =
                    (c.compensationAmount ?? 0) - (c.recoveryAmount ?? 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(c.date)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {c.program || (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs max-w-[220px] truncate">
                        {c.reason || (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {c.subOrderNo || (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                        {formatINR(c.compensationAmount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-orange-700">
                        {formatINR(c.recoveryAmount)}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right tabular-nums font-semibold " +
                          (net >= 0 ? "text-emerald-700" : "text-red-700")
                        }
                      >
                        {formatINR(net)}
                      </td>
                    </tr>
                  );
                })
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

function EmptyChart() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm">
      <RefreshCcw className="w-10 h-10 mb-2 opacity-40" />
      No compensation data yet
    </div>
  );
}
