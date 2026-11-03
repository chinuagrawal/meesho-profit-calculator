import { Link } from "react-router-dom";
import { ArrowUpRight, Store } from "lucide-react";
import type { AccountProfile } from "@/lib/accountProfile";

export function StoreIdentityCard({ profile, onClose }: { profile: AccountProfile; onClose: () => void }) {
  const initials = profile.storeName.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase();
  return <Link to="/settings" onClick={onClose} aria-label={`Manage ${profile.storeName}, owned by ${profile.fullName}`}
    className="group relative isolate mx-3 mt-4 mb-2 block shrink-0 overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-900/80 via-teal-950 to-slate-900 p-4 shadow-lg shadow-black/10 transition-colors hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
    <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 -z-10 h-28 w-28 rounded-full bg-emerald-300/10 blur-2xl" />
    <div className="flex items-center justify-between gap-2 mb-4"><span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200"><Store size={12} /> Your workspace</span><ArrowUpRight size={14} className="text-emerald-200/60 transition-colors group-hover:text-emerald-200" /></div>
    <div className="flex items-start gap-3 min-w-0"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-200 to-teal-300 text-sm font-bold text-emerald-950 shadow-sm ring-1 ring-white/20">{initials}</span><div className="min-w-0"><p className="text-base font-bold leading-snug tracking-tight text-white break-words">{profile.storeName}</p><span className="mt-1 block text-[10px] text-emerald-200/70">Meesho store</span></div></div>
    <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200/60">Store owner</p><p className="mt-1 text-sm font-medium leading-snug text-emerald-50 break-words">{profile.fullName}</p></div>
  </Link>;
}
