import { useEffect, useRef, useState, type FormEvent } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/config/firebase";
import { authError, normalizePhone } from "@/lib/authHelpers";
import { storage } from "@/services/storage";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CircleAlert, Download, LoaderCircle, Phone, ShieldCheck } from "lucide-react";
import { MarketingBrand } from "@/components/MarketingBrand";
import { ProfitPreview } from "@/components/ProfitPreview";
import "./marketing.css";
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
      verifier.current = new RecaptchaVerifier(auth, captcha.current, { size: "invisible" });
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
  return <main className="auth-page">
    <aside className="auth-story" aria-label="About your profit dashboard">
      <MarketingBrand light />
      <div className="auth-story-copy"><span className="marketing-eyebrow">A CLEARER VIEW OF YOUR BUSINESS.</span><h2>Good decisions<br />start with<br /><em>clear numbers.</em></h2><p>Your orders, costs and actual profit. Together in one place, ready whenever you are.</p></div>
      <ProfitPreview compact />
      <div className="auth-story-footer"><ShieldCheck size={19} /><span>Your business is personal.<br />Your dashboard stays in your account.</span></div><span className="auth-story-orbit" aria-hidden="true" />
    </aside>
    <section className="auth-main">
      <div className="auth-mobile-brand"><MarketingBrand /></div>
      <Link to="/" className="auth-back"><ArrowLeft size={14} /> Back to the good stuff</Link>
      <div className="auth-form-wrap">
        <div className="auth-stepper" aria-label={confirmation ? "Step 2 of 2: verify code" : "Step 1 of 2: your number"}><span className={!confirmation ? "is-active" : ""}><i>01</i> YOUR NUMBER</span><span className={confirmation ? "is-active" : ""}><i>02</i> VERIFY CODE</span></div>
        <h1>{confirmation ? <>Check your phone.<br /><em>You're almost in.</em></> : <>A fresh look at<br /><em>your business.</em></>}</h1>
        <p className="auth-form-subtitle">{confirmation ? "One little code, and your dashboard is ready." : "Sign in or create your account with a one-time code. No password to remember."}</p>
        {error && <div role="alert" className="auth-alert"><CircleAlert size={16} /><span>{error}</span></div>}
        {!confirmation ? <form onSubmit={send}>
          <div><label htmlFor="auth-phone" className="auth-label">Phone number</label><div className="auth-input-wrap"><Phone size={18} strokeWidth={1.5} /><input id="auth-phone" className="auth-input" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} aria-describedby="auth-phone-hint" /></div><p id="auth-phone-hint" className="auth-input-hint">Include your country code. We'll send a 6-digit SMS code.</p></div>
          <button type="submit" className="auth-submit" disabled={busy || cooldown > 0}><span>{busy ? "Getting your code ready…" : cooldown ? `Try again in ${cooldown}s` : "Continue with phone"}</span>{busy ? <LoaderCircle size={18} className="auth-spinner" /> : <ArrowRight size={18} />}</button>
          <p className="auth-consent">By continuing, you agree to receive a verification SMS. Google processes your number for authentication and abuse prevention. SMS charges may apply.</p>
        </form> : <form onSubmit={verify}>
          <div className="auth-sent">A verification code is on its way to <strong>{sentTo}</strong>.</div>
          <div><label htmlFor="auth-code" className="auth-label">Your 6-digit code</label><input id="auth-code" className="auth-input auth-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required disabled={busy} autoFocus /></div>
          <button type="submit" className="auth-submit" disabled={busy}><span>{busy ? "Opening your dashboard…" : "Verify & open dashboard"}</span>{busy ? <LoaderCircle size={18} className="auth-spinner" /> : <ArrowRight size={18} />}</button>
          <div className="auth-code-actions"><button type="button" disabled={busy || cooldown > 0} onClick={() => send()}>{cooldown ? `Resend code in ${cooldown}s` : "Send a new code"}</button><button type="button" disabled={busy} onClick={() => { setConfirmation(null); setCode(""); setError(""); }}>Use a different number</button></div>
        </form>}
        <div ref={captcha} className="captcha-slot" />
        <div className="auth-divider">YOUR ACCOUNT, YOUR NUMBERS</div>
        <div className="auth-security"><ShieldCheck size={15} strokeWidth={1.5} /> Private account. Saved across devices.</div>
        <p className="auth-privacy">Authorized developer support can inspect saved calculator data in read-only mode for troubleshooting. Support access is logged.</p>
        <p className="auth-privacy">Protected by reCAPTCHA. Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.</p>
        <div className="auth-legacy"><button type="button" onClick={downloadOldData}><Download size={13} /> Moving from the old calculator? Download your data.</button><p>Your previous browser data stays untouched. Restore the backup in Settings after signing in.</p></div>
      </div>
      <p className="auth-credit">A little clarity, built by <a href="https://www.instagram.com/chinmay.agrawal._/" target="_blank" rel="noreferrer">Chinmay Agrawal ↗</a></p>
    </section>
  </main>;
}
