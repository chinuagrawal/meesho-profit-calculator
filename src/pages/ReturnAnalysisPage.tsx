import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate, formatINR, formatPercent, formatMonthYear } from "@/lib/utils";
import { groupReturns, summarizeReturns } from "@/lib/returnAnalysis";

const monthLabel = (key: string) => key === "unknown" ? "Undated orders" : formatMonthYear(new Date(`${key}-01T00:00:00`));

export default function ReturnAnalysisPage() {
  const { filteredEnrichedOrders: orders } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const summary = useMemo(() => summarizeReturns(orders), [orders]);
  const months = useMemo(() => groupReturns(orders, "month"), [orders]);
  const skus = useMemo(() => groupReturns(orders, "sku"), [orders]);
  const rows = useMemo(() => orders.filter(order =>
    (order.liveOrderStatus === "Returned" || order.liveOrderStatus === "RTO") &&
    (status === "all" || order.liveOrderStatus === status) &&
    `${order.subOrderNo} ${order.supplierSKU} ${order.productName}`.toLowerCase().includes(search.toLowerCase())
  ), [orders, search, status]);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pages);
  return <div className="space-y-5 min-w-0">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="text-emerald-600" />Return Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">Customer returns and return-to-origin orders for the selected period.</p></div>
      <DateRangeFilter />
    </header>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      Overall return rate = (customer returns + RTOs) ÷ non-cancelled orders. Rates count orders, not units; shipped, pending and other statuses remain in the denominator. Dates refer to order dates, not the date a return occurred.
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Overall return rate", formatPercent(summary.overallRate), `${summary.total} of ${summary.eligible} non-cancelled orders`],
        ["Customer returns", String(summary.returned), `${formatPercent(summary.returnRate)} of non-cancelled orders`],
        ["RTO orders", String(summary.rto), `${formatPercent(summary.rtoRate)} of non-cancelled orders`],
        ["Return / RTO net profit", formatINR(summary.netProfit), summary.missingProfit ? `Partial: ${summary.missingProfit} orders lack calculable profit` : "Includes attributed ads; excludes unallocated ads"],
      ].map(([label, value, note]) => <Card key={label}><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold break-words">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></CardContent></Card>)}
    </div>
    {orders.length === 0 ? <Card className="p-8 text-center text-slate-500">No orders in this date range. Change the dates or <Link to="/import" className="text-emerald-700 underline">import a report</Link>.</Card> : <>
      <Breakdown title="Monthly return breakdown" rows={months} monthly />
      <Breakdown title="SKU return breakdown" rows={skus} />
    </>}
    <Card>
      <CardHeader><CardTitle>Return and RTO orders</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <input aria-label="Search returned orders" placeholder="Search order, SKU or product" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm min-w-0 w-full sm:w-72" />
          <select aria-label="Return type" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm"><option value="all">All returns and RTOs</option><option value="Returned">Customer returns</option><option value="RTO">RTO only</option></select>
          <Link to="/orders?filter=returns-review" className="text-sm text-emerald-700 underline self-center">Review return conditions</Link>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead className="bg-slate-50"><tr>{["Order", "Order date", "SKU", "Type", "Condition", "Settlement", "Net profit"].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{rows.slice((currentPage - 1) * 25, currentPage * 25).map(order => <tr key={order.id} className="border-t">
            <td className="p-3 whitespace-nowrap">{order.subOrderNo}</td><td className="p-3 whitespace-nowrap">{formatDate(order.orderDate)}</td><td className="p-3 max-w-xs break-words">{order.supplierSKU || "Unspecified SKU"}</td><td className="p-3">{order.liveOrderStatus === "Returned" ? "Customer return" : "RTO"}</td>
            <td className="p-3">{order.liveOrderStatus === "RTO" ? "—" : order.returnBreakdown ? `${order.returnBreakdown.effectiveCondition}${order.returnBreakdown.isManualOverride ? " (override)" : " (settings)"}` : "Needs review"}</td>
            <td className="p-3 whitespace-nowrap">{formatINR(order.finalSettlementAmount)}</td><td className="p-3 whitespace-nowrap">{formatINR(order.netProfit)}</td>
          </tr>)}</tbody>
        </table></div>
        {!rows.length && <p className="text-sm text-slate-500 py-4">No returns or RTOs match this selection.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{rows.length} orders · Page {currentPage} of {pages}</span><div className="flex gap-3"><button className="px-3 py-2 border rounded-lg disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="px-3 py-2 border rounded-lg disabled:opacity-40" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      </CardContent>
    </Card>
  </div>;
}

function Breakdown({ title, rows, monthly = false }: { title: string; rows: ReturnType<typeof groupReturns>; monthly?: boolean }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>
    <div className="overflow-auto max-h-96"><table className="w-full text-sm text-left">
      <thead className="bg-slate-50 sticky top-0"><tr>{[monthly ? "Order month" : "SKU", "Non-cancelled", "Customer returns", "RTOs", "Overall rate", "Net profit (returns + RTO)"].map(label => <th className="p-3 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className="border-t"><td className="p-3 max-w-xs break-words">{monthly ? monthLabel(row.key) : row.key}</td><td className="p-3">{row.eligible}</td><td className="p-3">{row.returned}</td><td className="p-3">{row.rto}</td><td className="p-3 font-semibold">{formatPercent(row.overallRate)}</td><td className="p-3 whitespace-nowrap">{formatINR(row.netProfit)}{row.missingProfit > 0 && <span className="block text-xs text-amber-700">Partial · {row.missingProfit} uncalculated</span>}</td></tr>)}</tbody>
    </table></div>
  </CardContent></Card>;
}
