import type { ServerResponse } from "node:http";
import type { ApiRequest } from "./cloudHandler.js";
import { ApiError } from "./cloudRepository.js";
import { BackendConfigurationError } from "./adminCredentials.js";
import type { createAdminRepository } from "./adminRepository.js";
import { validSnapshotId } from "../src/lib/cloudProtocol.js";

export function isAdminUid(uid: string, configured: string | undefined): boolean {
  return !!uid && (configured ?? "").split(",").map(value => value.trim()).filter(Boolean).includes(uid);
}
export function createAdminHandler(dependencies: {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  allowedUids: () => string | undefined;
  repository: () => ReturnType<typeof createAdminRepository>;
}) {
  return async (request: ApiRequest, response: ServerResponse) => {
    response.setHeader("Cache-Control", "no-store, private, max-age=0");
    response.setHeader("Vary", "Authorization");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status: number, value: unknown) => { response.statusCode = status; response.end(JSON.stringify(value)); };
    try {
      if (request.method !== "GET") { response.setHeader("Allow", "GET"); throw new ApiError(405, "Admin access is read-only."); }
      if (request.headers.origin) {
        let host: string;
        try { host = new URL(request.headers.origin).host; } catch { throw new ApiError(403, "Invalid origin."); }
        if (host !== request.headers.host) throw new ApiError(403, "Cross-site requests are not allowed.");
      }
      const header = request.headers.authorization;
      if (typeof header !== "string" || header.length > 8192 || !/^Bearer [^\s]+$/.test(header)) throw new ApiError(401, "Sign in to continue.");
      let uid: string;
      try { uid = (await dependencies.verifyToken(header.slice(7))).uid; }
      catch (error) { if (error instanceof BackendConfigurationError) throw error; throw new ApiError(401, "Your login expired or was revoked. Sign in again."); }
      if (!uid || uid.length > 128 || uid.includes("/")) throw new ApiError(401, "Invalid account.");
      const url = new URL(request.url ?? "/api/admin", "http://localhost");
      const action = url.searchParams.get("action");
      const admin = isAdminUid(uid, dependencies.allowedUids());
      if (action === "session" && url.searchParams.size === 1) return send(200, { admin });
      if (!admin) throw new ApiError(403, "This account does not have administrator access.");
      const fields = action === "users" ? ["action", "pageToken"] : action === "state" ? ["action", "uid"] : action === "chunk" ? ["action", "uid", "snapshotId", "index"] : [];
      if (!fields.length || [...url.searchParams.keys()].some(key => !fields.includes(key) || url.searchParams.getAll(key).length !== 1)) throw new ApiError(400, "Invalid admin request.");
      if (action === "users") {
        const token = url.searchParams.get("pageToken") ?? undefined;
        if (token !== undefined && (!token || token.length > 2048)) throw new ApiError(400, "Invalid page token.");
        return send(200, await dependencies.repository().users(uid, token));
      }
      const target = url.searchParams.get("uid");
      if (!target || target.length > 128 || target.includes("/") || [...target].some(character => character.charCodeAt(0) < 32)) throw new ApiError(400, "Invalid target account.");
      const repository = dependencies.repository();
      if (action === "state") return send(200, await repository.state(uid, target));
      const id = url.searchParams.get("snapshotId");
      const index = url.searchParams.get("index");
      if (!validSnapshotId(id) || !index || !/^\d{1,3}$/.test(index)) throw new ApiError(400, "Invalid snapshot request.");
      return send(200, await repository.chunk(uid, target, id, index));
    } catch (error) {
      if (error instanceof ApiError) return send(error.status, { error: error.message });
      if (error instanceof BackendConfigurationError) return send(503, { error: error.message });
      console.error("Admin read operation failed");
      return send(503, { error: "Admin data is temporarily unavailable. Check the backend permissions and retry." });
    }
  };
}
