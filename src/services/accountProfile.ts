import { cloudRequest } from "./cloudStorage";
import { parseAccountProfile, type AccountProfile } from "@/lib/accountProfile";
export async function loadAccountProfile(uid: string): Promise<AccountProfile | null> {
  const result = await cloudRequest(uid, "profile");
  return result.profile === null ? null : parseAccountProfile(result.profile);
}
export async function saveAccountProfile(uid: string, value: AccountProfile): Promise<AccountProfile> {
  const result = await cloudRequest(uid, "profile", parseAccountProfile(value));
  return parseAccountProfile(result.profile);
}
