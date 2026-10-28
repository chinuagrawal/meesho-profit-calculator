import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountFixture } from "./accountDataFixture";
import { snapshotHash, splitSnapshot } from "@/lib/cloudSnapshot";
const state = vi.hoisted(() => ({ uid: "owner", token: vi.fn() }));
vi.mock("@/config/firebase", () => ({ auth: { get currentUser() { return { uid: state.uid, getIdToken: state.token }; } } }));
import { AdminAccessError, loadAdminAccount } from "@/services/adminStorage";
const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { state.uid = "owner"; state.token.mockReset().mockResolvedValue("owner-token"); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); vi.stubGlobal("window", { setTimeout, clearTimeout }); });
afterEach(() => vi.unstubAllGlobals());
it("reads a target's verified snapshot with the administrator's token", async () => {
  const data = accountFixture(); const chunks = splitSnapshot(data); const hash = await snapshotHash(chunks.join(""));
  fetchMock.mockResolvedValueOnce(reply({ account: { uid: "customer" }, state: { version: 1, revision: 1, snapshotId: "saved", chunkCount: 1, hash }, updatedAt: null })).mockResolvedValueOnce(reply({ payload: chunks[0] }));
  const result = await loadAdminAccount("customer");
  expect(result.data).toEqual(data);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin?action=state&uid=customer");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  expect(fetchMock.mock.calls.every(call => call[1].cache === "no-store" && !call[1].body && !call[1].method)).toBe(true);
});
it("rejects corrupted data before displaying a report", async () => {
  const hash = await snapshotHash(splitSnapshot(accountFixture()).join(""));
  fetchMock.mockResolvedValueOnce(reply({ state: { version: 1, revision: 1, snapshotId: "saved", chunkCount: 1, hash } })).mockResolvedValueOnce(reply({ payload: "tampered" }));
  await expect(loadAdminAccount("customer")).rejects.toThrow("integrity");
});
it("stops on revoked access and refreshes an expired login at most once", async () => {
  fetchMock.mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({}, 403));
  await expect(loadAdminAccount("customer")).rejects.toBeInstanceOf(AdminAccessError);
  expect(fetchMock).toHaveBeenCalledTimes(2); expect(state.token).toHaveBeenCalledWith(true);
});
it("discards results when the signed-in account changes mid-request", async () => {
  fetchMock.mockImplementationOnce(async () => { state.uid = "other"; return reply({ state: null }); });
  await expect(loadAdminAccount("customer")).rejects.toThrow("login changed");
});
