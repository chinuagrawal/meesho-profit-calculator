import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import type { Firestore } from "firebase-admin/firestore";
import { createCloudHandler, type ApiRequest } from "../server/cloudHandler";
import { createAccountProfileRepository, profilePath } from "../server/accountProfileRepository";
import { parseAccountProfile } from "@/lib/accountProfile";
const profile = { get: vi.fn(), save: vi.fn() };
const cloud = { metadata: vi.fn(), chunk: vi.fn(), begin: vi.fn(), upload: vi.fn(), commit: vi.fn() };
const verifyToken = vi.fn();
const handler = createCloudHandler({ verifyToken, repository: () => cloud, profileRepository: () => profile });
async function request(method: string, query = "action=profile", body?: unknown) {
  const req = Readable.from([]) as ApiRequest;
  req.method = method; req.url = `/api/cloud?${query}`; req.body = body;
  req.headers = { host: "app.example", authorization: "Bearer token", "content-type": "application/json" };
  let result = "";
  const res = { statusCode: 200, setHeader: vi.fn(), end: (value: string) => { result = value; } };
  await handler(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: JSON.parse(result) };
}
beforeEach(() => { vi.resetAllMocks(); verifyToken.mockResolvedValue({ uid: "verified-user" }); });
describe("verified account profiles", () => {
  it("stores both names only under the authenticated UID", async () => {
    const names = { fullName: "Chinmay Agrawal", storeName: "My Store" };
    profile.save.mockResolvedValue(names);
    expect((await request("POST", undefined, names)).body).toEqual({ profile: names });
    expect(profile.save).toHaveBeenCalledWith("verified-user", names);
    profile.get.mockResolvedValue(names);
    expect((await request("GET")).body).toEqual({ profile: names });
    expect(profile.get).toHaveBeenCalledWith("verified-user");
  });
  it("blocks another target UID and revoked logins", async () => {
    expect((await request("GET", "action=profile&uid=other")).status).toBe(400);
    verifyToken.mockRejectedValue(new Error("revoked"));
    expect((await request("POST", undefined, {})).status).toBe(401);
    expect(profile.get).not.toHaveBeenCalled(); expect(profile.save).not.toHaveBeenCalled();
  });
  it("validates names while supporting international text and punctuation", () => {
    expect(parseAccountProfile({ fullName: "  Chinmay   Agrawal ", storeName: " दुकान & Co. " })).toEqual({ fullName: "Chinmay Agrawal", storeName: "दुकान & Co." });
    for (const value of [{ fullName: "", storeName: "Shop" }, { fullName: "Seller", storeName: " " }, { fullName: "Seller", storeName: "x".repeat(101) }, { fullName: "Seller\nName", storeName: "Shop" }, { fullName: "Seller", storeName: "Shop", uid: "other" }]) expect(() => parseAccountProfile(value)).toThrow();
  });
  it("preserves profile creation time and never writes calculator data", async () => {
    const ref = { get: vi.fn() };
    const doc = vi.fn(() => ref);
    const transaction = { get: vi.fn().mockResolvedValue({ data: () => ({ createdAt: "original-time" }) }), set: vi.fn() };
    const repo = createAccountProfileRepository({ doc, runTransaction: async (run: (value: typeof transaction) => unknown) => run(transaction) } as unknown as Firestore);
    await repo.save("verified-user", { fullName: "Seller Name", storeName: "Store Name" });
    expect(doc).toHaveBeenCalledWith(profilePath("verified-user"));
    expect(transaction.set).toHaveBeenCalledWith(ref, expect.objectContaining({ createdAt: "original-time", fullName: "Seller Name", storeName: "Store Name" }));
    await expect(repo.save("verified-user", { fullName: "Seller", storeName: "Store", admin: true })).rejects.toMatchObject({ status: 400 });
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });
});
