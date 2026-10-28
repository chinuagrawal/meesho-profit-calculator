import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
const cloud = vi.hoisted(() => ({ metadata: vi.fn(), chunk: vi.fn() }));
vi.mock("../server/cloudRepository", async importOriginal => ({ ...await importOriginal<object>(), createCloudRepository: () => cloud }));
import { createAdminRepository } from "../server/adminRepository";
const add = vi.fn();
const listUsers = vi.fn();
const getUser = vi.fn();
const repository = createAdminRepository({ collection: () => ({ add }) } as unknown as Firestore, { listUsers, getUser } as unknown as Auth);
const user = { uid: "customer", phoneNumber: "+919999999999", email: "user@example.test", disabled: false, passwordHash: "never-return-this", metadata: { creationTime: "2026-01-01", lastSignInTime: "2026-02-01" } };
beforeEach(() => { vi.resetAllMocks(); add.mockResolvedValue({}); getUser.mockResolvedValue(user); });
describe("admin data reads and audits", () => {
  it("lists paginated sanitized users and logs the actor", async () => {
    listUsers.mockResolvedValue({ users: [user], pageToken: "next" });
    const result = await repository.users("owner", "cursor");
    expect(listUsers).toHaveBeenCalledWith(50, "cursor");
    expect(result.nextPageToken).toBe("next");
    expect(result.users[0]).not.toHaveProperty("passwordHash");
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ actorUid: "owner", action: "list_accounts" }));
  });
  it("logs target account and snapshot before returning metadata", async () => {
    cloud.metadata.mockResolvedValue({ snapshotId: "current", updatedAt: { toDate: () => new Date("2026-01-01") } });
    const result = await repository.state("owner", "customer");
    expect(result.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ actorUid: "owner", targetUid: "customer", action: "view_account", snapshotId: "current" }));
  });
  it("returns nothing if recording an audit fails", async () => {
    cloud.metadata.mockResolvedValue(null); add.mockRejectedValue(new Error("audit unavailable"));
    await expect(repository.state("owner", "customer")).rejects.toThrow("audit unavailable");
  });
  it("prevents reads of old, uncommitted or out-of-range chunks", async () => {
    cloud.metadata.mockResolvedValue({ snapshotId: "current", chunkCount: 1 });
    await expect(repository.chunk("owner", "customer", "older", "0")).rejects.toMatchObject({ status: 409 });
    await expect(repository.chunk("owner", "customer", "current", "1")).rejects.toMatchObject({ status: 400 });
    expect(cloud.chunk).not.toHaveBeenCalled();
    cloud.chunk.mockResolvedValue({ payload: "saved data" });
    expect(await repository.chunk("owner", "customer", "current", "0")).toEqual({ payload: "saved data" });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ actorUid: "owner", targetUid: "customer", action: "read_snapshot_chunk" }));
  });
});
