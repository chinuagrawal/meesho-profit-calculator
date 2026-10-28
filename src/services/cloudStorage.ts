import { auth } from "@/config/firebase";
import { snapshotHash, splitSnapshot } from "@/lib/cloudSnapshot";
import { validCloudMetadata, validSnapshotId } from "@/lib/cloudProtocol";
import { parseBackup } from "./dataIntegrity";
import type { AppData } from "@/types";
export class CloudConflictError extends Error {
  constructor(message = "Another tab or device has newer cloud data. Download a local backup, then load the cloud version before making more changes.") { super(message); }
}
function requireAccount(uid: string) {
  if (auth.currentUser?.uid !== uid) throw new Error("Your login changed. Sign in again before syncing.");
  return auth.currentUser;
}
async function cloudRequest(uid: string, action: string, body?: unknown, params?: Record<string,string>, refresh = false): Promise<any> {
  const token = await requireAccount(uid).getIdToken(refresh);
  requireAccount(uid);
  const query = new URLSearchParams({action, ...params});
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(),50000);
  let response: Response;
  try {
    response = await fetch(`/api/cloud?${query}`, {
      method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : {"Content-Type":"application/json"}) },
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:controller.signal,
    });
  } catch { throw new Error("Could not reach the cloud backend. Your changes remain on this device. Reconnect and retry."); }
  finally { window.clearTimeout(timeout); }
  requireAccount(uid);
  if (response.status === 401 && !refresh) return cloudRequest(uid,action,body,params,true);
  let result;
  try { result = await response.json(); }
  catch { throw new Error("The cloud API is unavailable. Deploy the Vercel backend, or run the local API server alongside Vite."); }
  if (!response.ok) {
    const message = typeof result?.error === "string" ? result.error : "Cloud storage request failed.";
    if (response.status === 409) throw new CloudConflictError(message);
    throw new Error(message);
  }
  return result;
}
export async function loadCloudData(uid: string): Promise<{data:AppData;revision:number;hash:string} | null> {
  const result = await cloudRequest(uid,"state");
  if (result.state === null) return null;
  const meta = result.state;
  if (!validCloudMetadata(meta)) throw new Error("The cloud backup format is invalid. Your device data has not been changed.");
  const chunks: string[] = [];
  for (let start=0; start<meta.chunkCount; start+=4) {
    const group = await Promise.all(Array.from({length:Math.min(4,meta.chunkCount-start)},async (_,offset) => {
      const chunk = await cloudRequest(uid,"chunk",undefined,{snapshotId:meta.snapshotId,index:String(start+offset)});
      if (typeof chunk.payload !== "string") throw new Error("The cloud backup is incomplete.");
      return chunk.payload as string;
    }));
    chunks.push(...group);
  }
  const json = chunks.join("");
  if (await snapshotHash(json) !== meta.hash) throw new Error("The cloud backup failed its integrity check. Your device data has not been changed.");
  return {data:parseBackup(json),revision:meta.revision,hash:meta.hash};
}
export async function saveCloudData(uid: string, data: AppData, expectedRevision: number): Promise<{revision:number;hash:string}> {
  requireAccount(uid);
  const chunks = splitSnapshot(data);
  const hash = await snapshotHash(chunks.join(""));
  const session = await cloudRequest(uid,"begin",{chunkCount:chunks.length,expectedRevision,hash});
  if (!validSnapshotId(session.snapshotId)) throw new Error("The server returned an invalid upload session.");
  for (let start=0; start<chunks.length; start+=4) {
    await Promise.all(chunks.slice(start,start+4).map((payload,offset) => cloudRequest(uid,"chunk",{snapshotId:session.snapshotId,index:start+offset,payload})));
  }
  const saved = await cloudRequest(uid,"commit",{snapshotId:session.snapshotId});
  if (saved.revision !== expectedRevision+1 || saved.hash !== hash) throw new Error("The cloud save could not be verified. Load the cloud version before retrying.");
  return {revision:saved.revision,hash:saved.hash};
}
export function cloudError(error: unknown): string {
  return error instanceof Error ? error.message : "Cloud sync failed. Your changes remain on this device.";
}
