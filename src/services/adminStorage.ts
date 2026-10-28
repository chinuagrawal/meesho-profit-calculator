import { auth } from "@/config/firebase";
import { snapshotHash } from "@/lib/cloudSnapshot";
import { validCloudMetadata } from "@/lib/cloudProtocol";
import { parseBackup } from "@/services/dataIntegrity";
import type { AdminAccount } from "@/types/admin";
import type { AppData } from "@/types";

export class AdminAccessError extends Error {}
async function adminRequest<T>(params: Record<string, string>, signal?: AbortSignal, refresh = false): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AdminAccessError("Sign in to continue.");
  const token = await user.getIdToken(refresh);
  if (auth.currentUser?.uid !== user.uid) throw new AdminAccessError("Your login changed. Open the panel again.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 50000);
  let response: Response;
  try {
    response = await fetch(`/api/admin?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "same-origin", signal: controller.signal,
    });
  } finally { window.clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
  if (auth.currentUser?.uid !== user.uid) throw new AdminAccessError("Your login changed. Open the panel again.");
  if (response.status === 401 && !refresh) return adminRequest<T>(params, signal, true);
  if (response.status === 401 || response.status === 403) throw new AdminAccessError("This login does not have administrator access. Sign in with your authorized account.");
  const result = await response.json().catch(() => { throw new Error("The admin API is unavailable. Deploy the backend and try again."); });
  if (!response.ok) throw new Error(result.error ?? "Could not load admin data.");
  return result as T;
}
export function adminSession(signal?: AbortSignal) { return adminRequest<{ admin: boolean }>({ action: "session" }, signal); }
export function listAdminAccounts(pageToken?: string, signal?: AbortSignal) {
  return adminRequest<{ users: AdminAccount[]; nextPageToken: string | null }>({ action: "users", ...(pageToken ? { pageToken } : {}) }, signal);
}
export async function loadAdminAccount(uid: string, signal?: AbortSignal): Promise<{ account: AdminAccount; data: AppData | null; revision: number | null; updatedAt: string | null }> {
  const result = await adminRequest<{ account: AdminAccount; state: unknown; updatedAt: string | null }>({ action: "state", uid }, signal);
  if (result.state === null) return { account: result.account, data: null, revision: null, updatedAt: result.updatedAt };
  const meta = result.state;
  if (!validCloudMetadata(meta)) throw new Error("This account's cloud metadata is invalid.");
  const chunks: string[] = [];
  for (let start = 0; start < meta.chunkCount; start += 4) {
    const group = await Promise.all(Array.from({ length: Math.min(4, meta.chunkCount - start) }, async (_, offset) => {
      const chunk = await adminRequest<{ payload: string }>({ action: "chunk", uid, snapshotId: meta.snapshotId, index: String(start + offset) }, signal);
      if (typeof chunk.payload !== "string") throw new Error("This cloud snapshot is incomplete.");
      return chunk.payload;
    }));
    chunks.push(...group);
  }
  const json = chunks.join("");
  if (await snapshotHash(json) !== meta.hash) throw new Error("This account's snapshot failed its integrity check. Refresh before viewing.");
  // Read-only viewer: never restore customer data into browser storage or cloud sync.
  return { account: result.account, data: parseBackup(json), revision: meta.revision, updatedAt: result.updatedAt };
}
