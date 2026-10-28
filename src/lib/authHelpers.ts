export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s()-]/g, "");
  const phone = /^\d{10}$/.test(compact) ? `+91${compact}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Enter a valid phone number with country code, such as +91 followed by 10 digits.");
  return phone;
}
export function authError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Check your phone number and country code.",
    "auth/invalid-verification-code": "That code is incorrect. Please try again.",
    "auth/code-expired": "The code expired. Request a new code.",
    "auth/session-expired": "The code expired. Request a new code.",
    "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
    "auth/quota-exceeded": "SMS sending is unavailable. The project owner needs to check Firebase billing and SMS quotas.",
    "auth/operation-not-allowed": "Phone login is not enabled for this Firebase project. Enable Phone in Authentication and check the SMS region policy.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/captcha-check-failed": "Verification failed. Complete the security check and try again.",
    "auth/network-request-failed": "Check your connection and try again.",
    "auth/billing-not-enabled": "Firebase billing must be enabled before sending real SMS codes.",
    "auth/invalid-app-credential": "The app verification failed. Check the authorized domain and reCAPTCHA configuration in Firebase.",
  };
  return messages[code] || "Unable to sign in. Please try again or check the Firebase project setup.";
}
