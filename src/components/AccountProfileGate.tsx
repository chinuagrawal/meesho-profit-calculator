import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { loadAccountProfile, saveAccountProfile } from "@/services/accountProfile";
import { parseAccountProfile, type AccountProfile } from "@/lib/accountProfile";
import { MarketingBrand } from "./MarketingBrand";
import { ArrowRight, LoaderCircle, ShieldCheck, Store, UserRound } from "lucide-react";
import "@/pages/marketing.css";

const AccountProfileContext = createContext<{ profile: AccountProfile; save: (profile: AccountProfile) => Promise<void> } | null>(null);
export function useAccountProfile() { return useContext(AccountProfileContext); }

export function AccountProfileForm({ initial, onSave, onboarding = false }: { initial?: AccountProfile; onSave: (value: AccountProfile) => Promise<void>; onboarding?: boolean }) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSaved(false);
    try { await onSave(parseAccountProfile({ fullName, storeName })); setSaved(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your profile. Please retry."); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-5">
    {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    <div><label className="auth-label" htmlFor="profile-full-name">Full name</label><div className="auth-input-wrap"><UserRound size={18} /><input className="auth-input" id="profile-full-name" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={100} required value={fullName} disabled={busy} onChange={event => { setFullName(event.target.value); setSaved(false); }} /></div></div>
    <div><label className="auth-label" htmlFor="profile-store-name">Store name</label><div className="auth-input-wrap"><Store size={18} /><input className="auth-input" id="profile-store-name" autoComplete="organization" placeholder="Your Meesho store name" minLength={2} maxLength={100} required value={storeName} disabled={busy} onChange={event => { setStoreName(event.target.value); setSaved(false); }} /></div></div>
    <button className="auth-submit" type="submit" disabled={busy}><span>{busy ? "Saving your details…" : onboarding ? "Save & open dashboard" : "Save account details"}</span>{busy ? <LoaderCircle className="auth-spinner" size={18} /> : <ArrowRight size={18} />}</button>
    {saved && !onboarding && <p role="status" className="text-sm text-emerald-700">Account details saved.</p>}
  </form>;
}

export default function AccountProfileGate({ uid, children }: { uid: string; children: ReactNode }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void loadAccountProfile(uid).then(value => { if (active) { setProfile(value); setLoading(false); } }).catch(error => { if (active) { setError(error instanceof Error ? error.message : "Could not load account details."); setLoading(false); } });
    return () => { active = false; };
  }, [uid, retry]);
  const save = async (value: AccountProfile) => { const saved = await saveAccountProfile(uid, value); setProfile(saved); };
  if (loading) return null;
  if (profile && !error) return <AccountProfileContext.Provider value={{ profile, save }}>{children}</AccountProfileContext.Provider>;
  return <main className="min-h-screen bg-[#f7f8f2] px-4 py-8 sm:py-12 flex flex-col items-center">
    <MarketingBrand />
    <section className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 mt-8 sm:mt-12 shadow-sm">
      <div className="inline-flex rounded-xl p-3 bg-emerald-50 text-emerald-700 mb-5"><Store size={26} /></div>
      <p className="text-[10px] font-bold tracking-widest text-emerald-700 mb-3">FINISH SETTING UP YOUR ACCOUNT</p>
      <h1 className="text-3xl font-bold text-[#244935] tracking-tight">Make it your own.</h1>
      <p className="text-sm text-slate-500 leading-relaxed mt-3 mb-7">Your phone is verified. Add your full name and store name to complete your account. You only need to do this once.</p>
      {error ? <div role="alert" className="text-sm text-red-700 space-y-4"><p>{error}</p><button className="underline" onClick={() => setRetry(value => value + 1)}>Retry loading account details</button></div> : <AccountProfileForm onSave={save} onboarding />}
      <p className="text-xs text-slate-500 mt-6 flex gap-2 leading-relaxed"><ShieldCheck size={16} className="shrink-0" /> Saved securely with your verified account. You can update these details in Settings.</p>
      <button className="text-xs text-slate-500 underline mt-5" onClick={() => { void logout().catch(() => setError("Could not sign out. Please retry.")); }}>Use a different account</button>
    </section>
  </main>;
}
