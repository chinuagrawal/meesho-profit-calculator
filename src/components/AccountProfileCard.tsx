import { AccountProfileForm, useAccountProfile } from "./AccountProfileGate";
export function AccountProfileCard() {
  const account = useAccountProfile();
  if (!account) return null;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="font-semibold">Account details</h2><p className="text-sm text-slate-500 mt-1 mb-5">Your full name and Meesho store name, saved with your account.</p>
    <div className="max-w-lg"><AccountProfileForm initial={account.profile} onSave={account.save} /></div>
  </section>;
}
