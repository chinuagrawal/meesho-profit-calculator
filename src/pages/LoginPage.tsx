import { useEffect, useRef, useState, type FormEvent } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/config/firebase";
import { authError, normalizePhone } from "@/lib/authHelpers";
import { storage } from "@/services/storage";
import { Button, Input } from "@/components/ui";
export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const captcha = useRef<HTMLDivElement>(null);
  useEffect(() => () => { verifier.current?.clear(); verifier.current = null; }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy || cooldown) return;
    setError(""); setBusy(true);
    try {
      const normalized = normalizePhone(phone);
      if (!captcha.current) throw new Error("Verification is unavailable");
      verifier.current?.clear();
      verifier.current = new RecaptchaVerifier(auth, captcha.current, { size: "normal" });
      const result = await signInWithPhoneNumber(auth, normalized, verifier.current);
      setConfirmation(result); setSentTo(normalized); setCode(""); setCooldown(60);
    } catch (error) { setError(error instanceof Error && !('code' in error) ? error.message : authError(error)); verifier.current?.clear(); verifier.current = null; }
    finally { setBusy(false); }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault(); if (!confirmation || busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code from your SMS."); return; }
    setBusy(true); setError("");
    try { await confirmation.confirm(code.trim()); } catch (error) { setError(authError(error)); } finally { setBusy(false); }
  };
  const downloadOldData = async () => {
    try {
      const data = await storage.exportAllData();
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ...data, version: 1 })], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "meesho-previous-browser-backup.json"; link.click(); URL.revokeObjectURL(url);
    } catch { setError("Could not export browser data. Please try again."); }
  };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <section className="w-full max-w-md bg-white border rounded-2xl p-6 shadow-sm space-y-5">
      <div><h1 className="text-2xl font-bold">Meesho Profit Calculator</h1><p className="text-sm text-slate-600 mt-2">Sign in with your phone to access your private profit dashboard and save your data to your account.</p></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!confirmation ? <form onSubmit={send} className="space-y-4">
        <label className="block text-sm font-medium">Phone number<Input className="mt-1" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} /></label>
        <p className="text-xs text-slate-500">By requesting a code, you agree to receive a verification SMS. Google processes your phone number for authentication and abuse prevention. SMS charges may apply.</p>
        <Button type="submit" variant="primary" className="w-full" disabled={busy || cooldown > 0}>{busy ? "Sending code…" : cooldown ? `Try again in ${cooldown}s` : "Send OTP"}</Button>
      </form> : <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-slate-600">Code sent to {sentTo}.</p>
        <label className="block text-sm font-medium">Verification code<Input className="mt-1" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required disabled={busy} /></label>
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in"}</Button>
        <div className="flex justify-between gap-3 text-sm"><button type="button" disabled={busy || cooldown > 0} className="underline disabled:opacity-50" onClick={() => send()}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button><button type="button" disabled={busy} className="underline" onClick={() => { setConfirmation(null); setCode(""); setError(""); }}>Change number</button></div>
      </form>}
      <div ref={captcha} className="overflow-x-auto" />
      <p className="text-xs text-slate-500">Protected by reCAPTCHA. <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> and <a className="underline" href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.</p>
      <div className="border-t pt-4 text-xs text-slate-500"><button onClick={downloadOldData} className="underline">Download previous browser data</button><p className="mt-1">Existing local data stays untouched. After signing in, restore this backup in Settings to move it into your account.</p></div>
    </section>
  </main>;
}
