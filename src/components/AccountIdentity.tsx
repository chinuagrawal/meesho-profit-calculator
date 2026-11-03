import { useAuth } from "@/context/AuthContext";
import { useAccountProfile } from "./AccountProfileGate";
export function AccountIdentity() {
  const { user } = useAuth();
  const account = useAccountProfile();
  return <span className="min-w-0 max-w-48 text-slate-500" title={account ? `${account.profile.storeName} · ${account.profile.fullName}` : undefined}>
    {account && <span className="block truncate font-semibold text-slate-700">{account.profile.storeName}</span>}
    <span className="block truncate">{account ? `${account.profile.fullName} · ` : ""}{user?.phoneNumber ?? "Signed in"}</span>
  </span>;
}
