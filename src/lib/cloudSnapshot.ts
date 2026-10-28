import type { AppData } from "@/types";
import { parseBackup } from "../services/dataIntegrity";
import { SNAPSHOT_CHARS, MAX_CHUNKS } from "./cloudProtocol";
export { SNAPSHOT_CHARS, MAX_CHUNKS } from "./cloudProtocol";
export function splitSnapshot(data: AppData): string[] {
  const json = JSON.stringify({ ...data, version: 1 });
  // Validate before upload so an invalid restore cannot replace a good copy.
  parseBackup(json);
  const chunks: string[] = [];
  let chunk = "";
  for (const character of json) {
    if (chunk.length + character.length > SNAPSHOT_CHARS) { chunks.push(chunk); chunk = ""; }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  if (chunks.length > MAX_CHUNKS) throw new Error("This dataset is too large for cloud snapshots. Export a local backup first.");
  return chunks;
}
export async function snapshotHash(json: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function hasBusinessData(data: AppData): boolean {
  return [data.orders, data.ads, data.referrals, data.compensations, data.skuCosts].some(rows => rows.length > 0);
}
export interface SyncMarker { revision: number; dirty: boolean; hash: string }
export function readSyncMarker(uid: string): SyncMarker | null {
  try {
    const value = JSON.parse(localStorage.getItem(`mpc_cloud_sync:${uid}`) || "null");
    return value && Number.isInteger(value.revision) && value.revision >= 0 && typeof value.dirty === "boolean" && typeof value.hash === "string" ? value : null;
  } catch { return null; }
}
export function writeSyncMarker(uid: string, marker: SyncMarker): void {
  localStorage.setItem(`mpc_cloud_sync:${uid}`, JSON.stringify(marker));
}
