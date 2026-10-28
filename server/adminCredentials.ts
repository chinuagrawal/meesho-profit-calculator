export class BackendConfigurationError extends Error {}
export function readAdminCredentials(env: NodeJS.ProcessEnv) {
  let account: Record<string, unknown>;
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY); }
    catch { throw new BackendConfigurationError("FIREBASE_SERVICE_ACCOUNT_KEY must contain the complete service-account JSON."); }
  } else {
    account = { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY };
  }
  const expectedProject = env.FIREBASE_PROJECT_ID || "meesho-profit-calculator-99652";
  if (!account || typeof account !== "object" || typeof account.project_id !== "string" || typeof account.client_email !== "string" || typeof account.private_key !== "string" || !account.private_key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new BackendConfigurationError("Cloud backend is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel and redeploy.");
  }
  if (account.project_id !== expectedProject) throw new BackendConfigurationError("The service account belongs to a different Firebase project.");
  return { projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key.replace(/\\n/g, "\n") };
}
