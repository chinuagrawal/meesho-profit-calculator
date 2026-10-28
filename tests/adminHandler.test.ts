import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminHandler, isAdminUid } from "../server/adminHandler";
import type { ApiRequest } from "../server/cloudHandler";
const repository = { users: vi.fn(), state: vi.fn(), chunk: vi.fn() };
const getRepository = vi.fn(() => repository);
const verifyToken = vi.fn();
const handler = createAdminHandler({ verifyToken, allowedUids: () => "owner", repository: getRepository });
async function request(url: string, method = "GET", headers: Record<string, string> = {}) {
  const req = Readable.from([]) as ApiRequest;
  req.method = method; req.url = `/api/admin?${url}`;
  req.headers = { host: "app.example", authorization: "Bearer token", ...headers };
  let body = ""; const responseHeaders: Record<string, string> = {};
  const res = { statusCode: 200, setHeader: (key: string, value: string) => { responseHeaders[key] = value; }, end: (value: string) => { body = value; } };
  await handler(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: JSON.parse(body), headers: responseHeaders };
}
beforeEach(() => { vi.resetAllMocks(); getRepository.mockReturnValue(repository); verifyToken.mockResolvedValue({ uid: "owner" }); });
describe("read-only admin boundary", () => {
  it("defaults to no access and requires an exact server allowlist match", () => {
    expect(isAdminUid("owner", undefined)).toBe(false);
    expect(isAdminUid("owner", "")).toBe(false);
    expect(isAdminUid("own", "owner")).toBe(false);
    expect(isAdminUid("owner", "other, owner ")).toBe(true);
  });
  it("rejects missing and revoked tokens before touching the repository", async () => {
    expect((await request("action=users", "GET", { authorization: "" })).status).toBe(401);
    verifyToken.mockRejectedValue(new Error("revoked"));
    expect((await request("action=users")).status).toBe(401);
    expect(getRepository).not.toHaveBeenCalled();
  });
  it("rejects ordinary users even if they supply the owner UID or an admin claim", async () => {
    verifyToken.mockResolvedValue({ uid: "customer", admin: true });
    expect((await request("action=state&uid=owner")).status).toBe(403);
    expect((await request("action=chunk&uid=owner&snapshotId=saved&index=0")).status).toBe(403);
    expect((await request("action=users")).status).toBe(403);
    expect(getRepository).not.toHaveBeenCalled();
  });
  it("exposes only the caller's access flag in session checks", async () => {
    verifyToken.mockResolvedValue({ uid: "customer" });
    expect((await request("action=session")).body).toEqual({ admin: false });
    expect(getRepository).not.toHaveBeenCalled();
  });
  it("forwards the verified actor separately from the target account", async () => {
    repository.state.mockResolvedValue({ state: null });
    const response = await request("action=state&uid=customer");
    expect(response.status).toBe(200);
    expect(repository.state).toHaveBeenCalledWith("owner", "customer");
    expect(verifyToken).toHaveBeenCalledWith("token");
    expect(response.headers["Cache-Control"]).toContain("no-store");
  });
  it("rejects mutations, duplicate parameters and malformed target IDs", async () => {
    expect((await request("action=state&uid=customer", "POST")).status).toBe(405);
    expect((await request("action=state&uid=customer&uid=owner")).status).toBe(400);
    expect((await request("action=state&uid=..%2Fowner")).status).toBe(400);
    expect((await request("action=users&admin=true")).status).toBe(400);
    expect(repository.state).not.toHaveBeenCalled();
  });
  it("rejects cross-origin reads", async () => {
    expect((await request("action=users", "GET", { origin: "https://evil.example" })).status).toBe(403);
    expect(getRepository).not.toHaveBeenCalled();
  });
});
