import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { parseAccountProfile } from "../src/lib/accountProfile.js";
import { ApiError } from "./cloudRepository.js";

export const profilePath = (uid: string) => `users/${uid}/profile/details`;
export function storedProfile(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  return parseAccountProfile({ fullName: value.fullName, storeName: value.storeName });
}
export function createAccountProfileRepository(db: Firestore) {
  return {
    async get(uid: string) {
      const snapshot = await db.doc(profilePath(uid)).get();
      if (!snapshot.exists) return null;
      return storedProfile(snapshot.data());
    },
    async save(uid: string, body: Record<string, unknown>) {
      let profile;
      try { profile = parseAccountProfile(body); }
      catch (error) { throw new ApiError(400, (error as Error).message); }
      const ref = db.doc(profilePath(uid));
      await db.runTransaction(async transaction => {
        const previous = await transaction.get(ref);
        transaction.set(ref, { ...profile, createdAt: previous.data()?.createdAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
      return profile;
    },
  };
}
