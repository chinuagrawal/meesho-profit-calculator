import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { MAX_CHUNKS, SNAPSHOT_CHARS, validCloudMetadata, validSnapshotId } from "../src/lib/cloudProtocol.js";
import { parseBackup } from "../src/services/dataIntegrity.js";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const ttl = 15 * 60 * 1000;
function assertExact(data: Record<string, unknown>, fields: string[]) {
  if (Object.keys(data).some(key => !fields.includes(key)) || fields.some(key => !(key in data))) throw new ApiError(400, "Unexpected or missing request fields.");
}
export function createCloudRepository(db: Firestore) {
  const stateRef = (uid: string) => db.doc(`users/${uid}/calculator/state`);
  const sessionRef = (uid: string, id: string) => db.doc(`users/${uid}/uploads/${id}`);
  const chunkRef = (uid: string, id: string, index: number) => db.doc(`users/${uid}/snapshots/${id}/chunks/${index}`);
  const session = async (uid: string, id: unknown) => {
    if (!validSnapshotId(id)) throw new ApiError(400, "Invalid snapshot identifier.");
    const snapshot = await sessionRef(uid,id).get();
    const value = snapshot.data();
    if (!snapshot.exists || !value || value.committed || !(value.createdAt instanceof Timestamp) || Date.now() - value.createdAt.toMillis() > ttl) throw new ApiError(409, "This upload expired or was already committed. Retry the save.");
    return value;
  };
  const metadata = async (uid: string) => {
    const snapshot = await stateRef(uid).get();
    if (!snapshot.exists) return null;
    const value = snapshot.data();
    if (!validCloudMetadata(value)) throw new ApiError(500, "The cloud backup metadata is invalid. Your device data has not been changed.");
    return value;
  };
  return {
    metadata,
    async chunk(uid: string, id: string | null, index: string | null) {
      if (!validSnapshotId(id) || !index || !/^\d{1,3}$/.test(index) || Number(index) >= MAX_CHUNKS) throw new ApiError(400, "Invalid snapshot chunk.");
      const snapshot = await chunkRef(uid,id,Number(index)).get();
      const payload = snapshot.data()?.payload;
      if (!snapshot.exists || typeof payload !== "string") throw new ApiError(404, "The cloud backup is incomplete.");
      return { payload };
    },
    async begin(uid: string, body: Record<string, unknown>) {
      assertExact(body,["chunkCount","expectedRevision","hash"]);
      const {chunkCount,expectedRevision,hash} = body;
      if (typeof chunkCount !== "number" || !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS || typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new ApiError(400, "Invalid upload metadata.");
      const current = await metadata(uid);
      if ((current?.revision ?? 0) !== expectedRevision) throw new ApiError(409, "Another device has newer cloud data. Load the cloud version before saving.");
      const snapshotId = randomUUID();
      await sessionRef(uid,snapshotId).create({ chunkCount,expectedRevision,hash,createdAt:Timestamp.now(),committed:false });
      return {snapshotId};
    },
    async upload(uid: string, body: Record<string, unknown>) {
      assertExact(body,["snapshotId","index","payload"]);
      const {snapshotId,index,payload} = body;
      const current = await session(uid,snapshotId);
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= current.chunkCount || typeof payload !== "string" || payload.length > SNAPSHOT_CHARS || Buffer.byteLength(payload,"utf8") > 750000) throw new ApiError(400, "Invalid snapshot chunk payload.");
      const ref = chunkRef(uid,snapshotId as string,index);
      await db.runTransaction(async transaction => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
          if (existing.data()?.payload !== payload) throw new ApiError(409, "A different chunk already exists for this upload.");
          return;
        }
        transaction.create(ref,{payload});
      });
      return {ok:true};
    },
    async commit(uid: string, body: Record<string, unknown>) {
      assertExact(body,["snapshotId"]);
      const snapshotId = body.snapshotId;
      const current = await session(uid,snapshotId);
      const snapshots = await db.getAll(...Array.from({length:current.chunkCount},(_, index) => chunkRef(uid,snapshotId as string,index)));
      const chunks = snapshots.map(snapshot => {
        const payload = snapshot.data()?.payload;
        if (!snapshot.exists || typeof payload !== "string") throw new ApiError(400, "Not all snapshot chunks were uploaded. Retry the save.");
        return payload;
      });
      const json = chunks.join("");
      const hash = createHash("sha256").update(json).digest("hex");
      if (hash !== current.hash) throw new ApiError(400, "Snapshot checksum mismatch.");
      try { parseBackup(json); } catch { throw new ApiError(400, "The uploaded calculator data is invalid. The previous cloud copy is unchanged."); }
      await db.runTransaction(async transaction => {
        const ref = stateRef(uid);
        const uploadRef = sessionRef(uid,snapshotId as string);
        const [previous, upload] = await Promise.all([transaction.get(ref),transaction.get(uploadRef)]);
        if (!upload.exists || upload.data()?.committed) throw new ApiError(409, "This upload was already committed. Reload cloud data.");
        const revision = previous.exists ? previous.data()?.revision : 0;
        if (revision !== current.expectedRevision) throw new ApiError(409, "Another device has newer cloud data. Load the cloud version before saving.");
        transaction.set(ref,{version:1,revision:revision+1,snapshotId,chunkCount:current.chunkCount,hash,updatedAt:FieldValue.serverTimestamp()});
        transaction.update(uploadRef,{committed:true});
      });
      return {revision:current.expectedRevision+1,hash};
    },
  };
}
