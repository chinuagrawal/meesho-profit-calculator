import type { Auth, UserRecord } from "firebase-admin/auth";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ApiError, createCloudRepository } from "./cloudRepository.js";
import type { AdminAccount } from "../src/types/admin.js";
import type { AccountProfile } from "../src/lib/accountProfile.js";
import { profilePath, storedProfile } from "./accountProfileRepository.js";

function account(user: UserRecord, profile?: AccountProfile | null): AdminAccount {
  return { uid: user.uid, phoneNumber: user.phoneNumber ?? null, email: user.email ?? null,
    fullName: profile?.fullName ?? null, storeName: profile?.storeName ?? null,
    createdAt: user.metadata.creationTime, lastSignInAt: user.metadata.lastSignInTime || null, disabled: user.disabled };
}

export function createAdminRepository(db: Firestore, auth: Auth) {
  const cloud = createCloudRepository(db);
  const audit = async (actorUid: string, action: string, targetUid?: string, snapshotId?: string) => {
    // Fail closed: no customer data is returned if recording access fails.
    await db.collection("adminAudit").add({ actorUid, action, targetUid: targetUid ?? null,
      snapshotId: snapshotId ?? null, accessedAt: FieldValue.serverTimestamp() });
  };
  return {
    async users(actorUid: string, pageToken?: string) {
      const result = await auth.listUsers(50, pageToken);
      const profiles = result.users.length ? await db.getAll(...result.users.map(user => db.doc(profilePath(user.uid)))) : [];
      await audit(actorUid, "list_accounts");
      return { users: result.users.map((user, index) => account(user, profiles[index]?.exists ? storedProfile(profiles[index].data()) : null)), nextPageToken: result.pageToken ?? null };
    },
    async state(actorUid: string, targetUid: string) {
      let user: UserRecord;
      try { user = await auth.getUser(targetUid); }
      catch (error) {
        if ((error as { code?: string }).code === "auth/user-not-found") throw new ApiError(404, "Account not found.");
        throw error;
      }
      const state = await cloud.metadata(targetUid);
      const profile = await db.doc(profilePath(targetUid)).get();
      await audit(actorUid, "view_account", targetUid, state?.snapshotId);
      // Firestore Timestamp is not part of the portable snapshot protocol.
      const updatedAt = (state as unknown as { updatedAt?: { toDate?: () => Date } } | null)?.updatedAt?.toDate?.().toISOString() ?? null;
      return { account: account(user, profile.exists ? storedProfile(profile.data()) : null), state, updatedAt };
    },
    async chunk(actorUid: string, targetUid: string, snapshotId: string, index: string) {
      const state = await cloud.metadata(targetUid);
      if (!state || state.snapshotId !== snapshotId) throw new ApiError(409, "This account has newer data. Open the account again to refresh.");
      if (!/^\d{1,3}$/.test(index) || Number(index) >= state.chunkCount) throw new ApiError(400, "Invalid chunk index.");
      const result = await cloud.chunk(targetUid, snapshotId, index);
      await audit(actorUid, "read_snapshot_chunk", targetUid, snapshotId);
      return result;
    },
  };
}
