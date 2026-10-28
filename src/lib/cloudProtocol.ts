export const SNAPSHOT_CHARS = 150_000;
export const MAX_CHUNKS = 128;
export interface CloudMetadata { version: 1; revision: number; snapshotId: string; chunkCount: number; hash: string }
export function validSnapshotId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
export function validCloudMetadata(value: unknown): value is CloudMetadata {
  if (!value || typeof value !== "object") return false;
  const meta = value as CloudMetadata;
  return meta.version === 1 && Number.isSafeInteger(meta.revision) && meta.revision >= 1 && validSnapshotId(meta.snapshotId) && Number.isInteger(meta.chunkCount) && meta.chunkCount >= 1 && meta.chunkCount <= MAX_CHUNKS && typeof meta.hash === "string" && /^[a-f0-9]{64}$/.test(meta.hash);
}
