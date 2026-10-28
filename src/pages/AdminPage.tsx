import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Eye, Search, ShieldCheck, Users } from "lucide-react";
import { AdminAccessError, listAdminAccounts, loadAdminAccount } from "@/services/adminStorage";
import type { AdminAccount } from "@/types/admin";
import type { AppData } from "@/types";
import { buildAdminReport } from "@/lib/adminReport";
import { formatINR } from "@/lib/utils";

type Row = object;
type Column = { key: string; label: string; money?: boolean };
const column = (key: string, label: string, money = false): Column => ({ key, label, money });
const columns = {
  months: [column("monthLabel", "Month"), column("orders", "Orders"), column("settlement", "Settlement", true), column("purchaseCost", "Purchase cost", true), column("adSpend", "Advertising", true), column("profit", "Cash profit", true)],
  orders: [column("subOrderNo", "Order"), column("supplierSKU", "SKU"), column("orderDate", "Date"), column("liveOrderStatus", "Status"), column("finalSettlementAmount", "Settlement", true), column("actualPurchaseAmountPaid", "Purchase cost", true), column("netProfit", "Attributed profit", true)],
  skus: [column("supplierSKU", "SKU"), column("units", "Units"), column("settlement", "Settlement", true), column("purchaseCost", "Purchase cost", true), column("profit", "Attributed profit", true)],
  skuCosts: [column("supplierSKU", "SKU"), column("productName", "Product"), column("purchaseCostInclGST", "Cost incl. GST", true), column("gstRate", "GST rate")],
  ads: [column("deductionDate", "Date"), column("deductionDuration", "Period"), column("campaignID", "Campaign"), column("adCost", "Ad cost", true), column("totalAdsCost", "Total cost (saved)", true)],
  referrals: [column("date", "Date"), column("subOrderNo", "Order"), column("reason", "Reason"), column("amount", "Amount", true)],
  compensations: [column("date", "Date"), column("subOrderNo", "Order"), column("reason", "Reason"), column("compensationAmount", "Compensation", true), column("recoveryAmount", "Recovery", true)],
  settings: [column("name", "Setting"), column("value", "Saved value")],
};
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40";
function display(value: unknown) {
  if (value == null || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString("en-IN");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function AccountLabel({ account }: { account: AdminAccount }) {
  return <><span className="font-semibold">{account.phoneNumber ?? account.email ?? "Account"}</span><span className="block text-xs font-mono text-slate-500 break-all mt-1">{account.uid}</span></>;
}
export function AdminDataTable({ rows, fields, title }: { rows: Row[]; fields: Column[]; title: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Row | null>(null);
  const filtered = useMemo(() => rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  return <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{title}</h3><p className="text-xs text-slate-500 mt-1">{filtered.length.toLocaleString("en-IN")} records · Read-only</p></div><input aria-label={`Search ${title}`} placeholder="Search records…" className="rounded-lg border px-3 py-2 text-sm w-full sm:w-56" value={search} onChange={event => { setSearch(event.target.value); setPage(0); setDetail(null); }} /></div>
    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 border-y text-slate-500"><tr>{fields.map(field => <th key={field.key} className="px-4 py-3 whitespace-nowrap font-medium">{field.label}</th>)}<th className="px-4 py-3">Details</th></tr></thead><tbody>{filtered.slice(page * 25, (page + 1) * 25).map((row, index) => <tr key={index} className="border-b last:border-0">{fields.map(field => { const value = (row as Record<string, unknown>)[field.key]; return <td key={field.key} className="px-4 py-3 max-w-64 truncate" title={display(value)}>{field.money && typeof value === "number" ? formatINR(value) : display(value)}</td>; })}<td className="px-4 py-3"><button className="relative text-emerald-700 underline whitespace-nowrap" onClick={() => setDetail(row)}>View fields<span className="sr-only"> for record {page * 25 + index + 1}</span></button></td></tr>)}</tbody></table></div>
    {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No records to show.</p>}
    <div className="p-4 flex items-center justify-between gap-3 text-xs text-slate-500"><span>Page {page + 1} of {pages}</span><div className="flex gap-2"><button className={button} disabled={page === 0} onClick={() => { setPage(page - 1); setDetail(null); }}>Previous</button><button className={button} disabled={page + 1 >= pages} onClick={() => { setPage(page + 1); setDetail(null); }}>Next</button></div></div>
    {detail && <div className="border-t bg-slate-50 p-4"><div className="flex justify-between mb-3"><h4 className="font-semibold text-sm">All saved fields & calculation details</h4><button className="text-sm underline" onClick={() => setDetail(null)}>Close details</button></div><pre className="text-xs whitespace-pre-wrap break-all max-h-96 overflow-auto">{JSON.stringify(detail, null, 2)}</pre></div>}
  </section>;
}
export function AdminAccountReport({ data }: { data: AppData }) {
  const report = useMemo(() => buildAdminReport(data), [data]);
  const [tab, setTab] = useState<keyof typeof columns | "overview">("overview");
  const tabs = { overview: "Overview", months: "Monthly report", orders: "Orders", skus: "SKU report", skuCosts: "Purchase costs", ads: "Advertising", referrals: "Referrals", compensations: "Compensation", settings: "Settings & returns" };
  const rows: Record<keyof typeof columns, Row[]> = { months: report.months, orders: report.orders, skus: report.skus, skuCosts: data.skuCosts, ads: data.ads, referrals: data.referrals, compensations: data.compensations,
    settings: [{ name: "GST settings", value: data.gstSettings }, { name: "User settings", value: data.userSettings }, ...Object.entries(data.returnOverrides ?? {}).map(([order, condition]) => ({ name: `Return: ${order}`, value: condition }))] };
  return <div className="space-y-5">
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Account reports">{Object.entries(tabs).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={`rounded-full px-4 py-2 text-sm whitespace-nowrap ${tab === key ? "bg-slate-900 text-white" : "bg-white border text-slate-600"}`} onClick={() => setTab(key as typeof tab)}>{label}</button>)}</div>
    {tab === "overview" ? <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[{ label: "Total settlement", value: report.settlement }, { label: "Purchase cost", value: report.purchaseCost }, { label: "Actual ad spend", value: report.adSpend }, { label: "Net cash profit", value: report.profit }].map(metric => <div key={metric.label} className="rounded-2xl border bg-white p-4 sm:p-5"><p className="text-xs text-slate-500">{metric.label}</p><p className={`mt-3 text-xl sm:text-2xl font-bold tabular-nums break-all ${metric.label === "Net cash profit" ? metric.value < 0 ? "text-red-600" : "text-emerald-700" : "text-slate-900"}`}>{formatINR(metric.value)}</p></div>)}</div>
      {(report.missingProfit > 0 || report.malformedAds > 0) && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{report.missingProfit > 0 && <p>{report.missingProfit} orders have incomplete profit calculations. Totals include calculable amounts only.</p>}{report.malformedAds > 0 && <p>{report.malformedAds} malformed advertising entries are excluded from profit totals.</p>}</div>}
      <div className="grid sm:grid-cols-3 gap-3 text-sm">{[["Orders", data.orders.length], ["Delivered", report.orders.filter(row => row.liveOrderStatus === "Delivered").length], ["RTO / returns", `${report.orders.filter(row => row.liveOrderStatus === "RTO").length} / ${report.orders.filter(row => row.liveOrderStatus === "Returned").length}`], ["Output GST", formatINR(report.outputGST)], ["Input GST", formatINR(report.inputGST)], ["Saved SKU costs", data.skuCosts.length]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4 flex justify-between gap-2"><span className="text-slate-500">{label}</span><strong>{value}</strong></div>)}</div>
      <p className="text-xs leading-relaxed text-slate-500">All-time snapshot. Business profit deducts actual advertising spend; order and SKU reports use attributed advertising. Separate referral and compensation payments are shown in their own reports. Original Excel files are not stored; the saved imported rows and source fields are available here.</p>
      <AdminDataTable rows={report.months} fields={columns.months} title="Monthly profit comparison" />
    </> : <AdminDataTable key={tab} rows={rows[tab]} fields={columns[tab]} title={tabs[tab]} />}
  </div>;
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listBusy, setListBusy] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAdminAccount>> | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const viewRequest = useRef<AbortController | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const handleError = (error: unknown) => { setError(error instanceof Error ? error.message : "Could not load account data."); if (error instanceof AdminAccessError) { setAccessDenied(true); setAccounts([]); setSnapshot(null); setSelected(null); viewRequest.current?.abort(); } };
  const loadAccounts = async (token?: string) => {
    listRequest.current?.abort();
    const controller = new AbortController(); listRequest.current = controller;
    setListBusy(true); setError("");
    try { const result = await listAdminAccounts(token, controller.signal); if (!controller.signal.aborted) { setAccounts(previous => token ? [...previous, ...result.users.filter(user => !previous.some(row => row.uid === user.uid))] : result.users); setNext(result.nextPageToken); setAccessDenied(false); } }
    catch (error) { if (!controller.signal.aborted) handleError(error); }
    finally { if (!controller.signal.aborted) setListBusy(false); }
  };
  useEffect(() => { void loadAccounts(); return () => { listRequest.current?.abort(); viewRequest.current?.abort(); }; }, []);
  const openAccount = async (account: AdminAccount) => {
    viewRequest.current?.abort();
    const controller = new AbortController(); viewRequest.current = controller;
    setSelected(account); setSnapshot(null); setViewBusy(true); setError("");
    try { const result = await loadAdminAccount(account.uid, controller.signal); if (!controller.signal.aborted) setSnapshot(result); }
    catch (error) { if (!controller.signal.aborted) handleError(error); }
    finally { if (!controller.signal.aborted) setViewBusy(false); }
  };
  const visible = accounts.filter(account => `${account.phoneNumber ?? ""} ${account.email ?? ""} ${account.uid}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-white border-b px-4 sm:px-8 py-5 flex flex-wrap justify-between gap-4"><div className="flex gap-3 items-center"><span className="rounded-xl bg-emerald-50 text-emerald-700 p-3"><ShieldCheck size={23} /></span><div><p className="uppercase tracking-widest text-[10px] text-emerald-700 font-bold">Developer workspace</p><h1 className="font-bold text-xl">Account insights</h1></div></div><Link to="/" className={button}><ArrowLeft size={15} /> My dashboard</Link></header>
    <div className="max-w-screen-2xl mx-auto p-4 sm:p-8 space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Eye size={18} className="shrink-0 mt-0.5" /><p><strong>Read-only support access.</strong> You stay signed in as yourself. Viewing customer accounts is logged. Only their latest cloud-saved data is shown; unsynced device changes are unavailable.</p></div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => { if (selected && !accessDenied) void openAccount(selected); else void loadAccounts(); }}>Retry</button></div>}
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <aside className="rounded-2xl border bg-white p-4 lg:sticky lg:top-4"><div className="flex justify-between items-center gap-2"><h2 className="font-semibold flex items-center gap-2"><Users size={17} /> Accounts</h2><button className="text-xs underline text-slate-500 disabled:opacity-40" disabled={listBusy} onClick={() => void loadAccounts()}>Refresh list</button></div><label className="flex items-center gap-2 mt-4 border rounded-lg px-3"><Search size={15} className="text-slate-400" /><input aria-label="Search loaded accounts" className="w-full min-w-0 py-2.5 text-sm outline-none" placeholder="Phone, email or UID" value={search} onChange={event => setSearch(event.target.value)} /></label><p className="text-xs text-slate-400 my-3">{accounts.length} accounts loaded · Search this list</p>
          <div className="max-h-72 lg:max-h-[60vh] overflow-y-auto space-y-2">{visible.map(account => <button key={account.uid} onClick={() => void openAccount(account)} className={`block text-left w-full p-3 rounded-xl text-sm border ${selected?.uid === account.uid ? "border-emerald-300 bg-emerald-50" : "border-transparent hover:bg-slate-50"}`}><AccountLabel account={account} /><span className="block mt-2 text-[11px] text-slate-500">{account.disabled ? "Disabled" : "Active"} · {account.lastSignInAt ? `Last login ${new Date(account.lastSignInAt).toLocaleDateString("en-IN")}` : "No recorded sign-in"}</span></button>)}</div>
          {listBusy && <p role="status" className="p-4 text-sm text-slate-500">Loading accounts…</p>}{!listBusy && !visible.length && <p className="py-4 text-sm text-slate-500">{accessDenied ? "Administrator login required." : "No matching accounts."}</p>}{next && !accessDenied && <button className={`${button} w-full mt-3`} disabled={listBusy} onClick={() => void loadAccounts(next)}>Load more accounts</button>}
        </aside>
        <div className="min-w-0 space-y-5">{selected ? <><section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-2">Viewing another account · read-only</p><h2><AccountLabel account={snapshot?.account ?? selected} /></h2></div><button className={button} disabled={viewBusy} onClick={() => void openAccount(selected)}>Refresh saved data <ArrowUpRight size={14} /></button></div><p className="text-xs text-slate-500 mt-3">{snapshot?.updatedAt ? `Last cloud save: ${new Date(snapshot.updatedAt).toLocaleString("en-IN")}` : "Cloud save time unavailable"}{snapshot?.revision ? ` · Revision ${snapshot.revision}` : ""}</p></section>
          {viewBusy && <div role="status" className="p-12 rounded-2xl border bg-white text-center text-slate-500">Checking the saved snapshot…</div>}
          {snapshot && (snapshot.data ? <AdminAccountReport key={`${selected.uid}:${snapshot.revision}`} data={snapshot.data} /> : <div className="rounded-2xl border bg-white p-10"><h3 className="font-semibold">No cloud report yet</h3><p className="text-sm text-slate-500 mt-2">This account has signed in but has no saved calculator snapshot. Device-only data cannot be viewed here.</p></div>)}
        </> : <div className="rounded-2xl border border-dashed bg-white p-10 sm:p-20 text-center"><Users className="mx-auto text-emerald-600 mb-4" size={32} /><h2 className="text-xl font-semibold">Choose an account to inspect</h2><p className="text-sm text-slate-500 max-w-md mx-auto mt-3 leading-relaxed">Review monthly profit, orders, purchase costs, advertising, referrals, compensation and saved settings.</p></div>}</div>
      </div>
    </div>
  </main>;
}
