import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { AdminLink } from "./AdminLink";
import { AccountIdentity } from "./AccountIdentity";
export function AccountControls() {
  const { logout } = useAuth();
  const { cloudStatus, cloudSyncError } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="border-b border-slate-200 bg-white px-4 py-2 flex flex-wrap justify-between items-center gap-2 text-xs">
    <AdminLink />
    <Link to="/settings" className={cloudSyncError ? "text-red-700 underline" : "text-slate-500"} title={cloudSyncError ?? cloudStatus}>{cloudStatus}{cloudSyncError ? " — review in Settings" : ""}</Link>
    <div className="flex gap-3 items-center min-w-0"><AccountIdentity /><button className="underline disabled:opacity-50 shrink-0" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await logout(); } catch { setError("Sign out failed. Try again."); } finally { setBusy(false); } }}>{busy ? "Signing out…" : "Sign out"}</button>{error && <span role="alert" className="text-red-700">{error}</span>}</div>
  </div>;
}
