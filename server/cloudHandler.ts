import type { IncomingMessage, ServerResponse } from "node:http";
import { ApiError } from "./cloudRepository.js";
import { BackendConfigurationError } from "./adminCredentials.js";
import type { createCloudRepository } from "./cloudRepository.js";
export interface ApiRequest extends IncomingMessage { body?: unknown }
export interface CloudDependencies {
  verifyToken: (token: string) => Promise<{uid: string}>;
  repository: () => ReturnType<typeof createCloudRepository>;
}
async function readBody(request: ApiRequest): Promise<Record<string, unknown>> {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) throw new ApiError(415,"Send JSON data.");
  const limit = 800_000;
  let body = request.body;
  if (body === undefined) {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); bytes += buffer.length; if (bytes > limit) throw new ApiError(413,"Request is too large."); chunks.push(buffer); }
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body as string) > limit) throw new ApiError(413,"Request is too large.");
    try { body = JSON.parse(body.toString()); } catch { throw new ApiError(400,"Invalid JSON."); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400,"Invalid JSON object.");
  if (Buffer.byteLength(JSON.stringify(body)) > limit) throw new ApiError(413,"Request is too large.");
  return body as Record<string,unknown>;
}
export function createCloudHandler(dependencies: CloudDependencies) {
  return async (request: ApiRequest, response: ServerResponse) => {
    response.setHeader("Cache-Control","no-store, private, max-age=0");
    response.setHeader("Vary","Authorization");
    response.setHeader("Content-Type","application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options","nosniff");
    const send = (status: number, data: unknown) => {response.statusCode=status; response.end(JSON.stringify(data));};
    try {
      if (request.method !== "GET" && request.method !== "POST") { response.setHeader("Allow","GET, POST"); throw new ApiError(405,"Method not allowed."); }
      const origin = request.headers.origin;
      if (origin) {
        let host: string;
        try { host = new URL(origin).host; } catch { throw new ApiError(403,"Invalid request origin."); }
        if (host !== request.headers.host) throw new ApiError(403,"Cross-site requests are not allowed.");
      }
      const header = request.headers.authorization;
      if (typeof header !== "string" || header.length > 8192 || !/^Bearer [^\s]+$/.test(header)) throw new ApiError(401,"Sign in to access cloud storage.");
      let uid: string;
      try { uid = (await dependencies.verifyToken(header.slice(7))).uid; }
      catch (error) { if (error instanceof BackendConfigurationError) throw error; throw new ApiError(401,"Your login expired or was revoked. Sign in again."); }
      if (!uid || uid.length > 128 || uid.includes("/")) throw new ApiError(401,"Invalid account.");
      const url = new URL(request.url ?? "/api/cloud","http://localhost");
      const action = url.searchParams.get("action");
      const allowed = request.method === "GET" && action === "chunk" ? ["action","snapshotId","index"] : ["action"];
      if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) throw new ApiError(400,"Unexpected query parameters.");
      const repository = dependencies.repository();
      if (request.method === "GET") {
        if (action === "state") return send(200,{state:await repository.metadata(uid)});
        if (action === "chunk") return send(200,await repository.chunk(uid,url.searchParams.get("snapshotId"),url.searchParams.get("index")));
      } else {
        const body = await readBody(request);
        if (action === "begin") return send(200,await repository.begin(uid,body));
        if (action === "chunk") return send(200,await repository.upload(uid,body));
        if (action === "commit") return send(200,await repository.commit(uid,body));
      }
      throw new ApiError(400,"Unknown cloud operation.");
    } catch (error) {
      if (error instanceof ApiError) return send(error.status,{error:error.message});
      if (error instanceof BackendConfigurationError) return send(503,{error:error.message});
      // Do not log tokens, payloads, environment variables or credential errors.
      console.error("Cloud API operation failed");
      return send(503,{error:"Cloud storage is unavailable. Your device data is unchanged. Check the server Firebase setup and retry."});
    }
  };
}
