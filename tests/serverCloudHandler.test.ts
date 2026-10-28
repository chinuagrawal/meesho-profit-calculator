import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudHandler, type ApiRequest } from "../server/cloudHandler";
import { BackendConfigurationError } from "../server/adminCredentials";
const repo = {metadata:vi.fn(),chunk:vi.fn(),begin:vi.fn(),upload:vi.fn(),commit:vi.fn()};
const verifyToken = vi.fn();
const handler = createCloudHandler({verifyToken,repository:()=>repo});
async function request(method:string,url:string,body?:unknown,headers:Record<string,string>={}) {
  const req = Readable.from([]) as ApiRequest;
  req.method=method;req.url=url;req.headers={host:"app.example",authorization:"Bearer valid-token","content-type":"application/json",...headers};req.body=body;
  let value="";const responseHeaders:Record<string,string>={};
  const res={statusCode:200,setHeader:(key:string,value:string)=>{responseHeaders[key]=value;},end:(text:string)=>{value=text;}};
  await handler(req,res as unknown as ServerResponse);
  return {status:res.statusCode,body:JSON.parse(value),headers:responseHeaders};
}
beforeEach(()=>{vi.resetAllMocks();verifyToken.mockResolvedValue({uid:"verified-owner"});repo.metadata.mockResolvedValue(null);});
describe("authenticated cloud API",()=>{
  it("rejects missing or revoked tokens before database access",async()=>{
    expect((await request("GET","/api/cloud?action=state",undefined,{authorization:""})).status).toBe(401);expect(repo.metadata).not.toHaveBeenCalled();
    verifyToken.mockRejectedValue(new Error("revoked"));expect((await request("GET","/api/cloud?action=state")).status).toBe(401);expect(repo.metadata).not.toHaveBeenCalled();
  });
  it("uses the verified UID and disables response caching",async()=>{
    const response=await request("GET","/api/cloud?action=state");expect(response.status).toBe(200);expect(repo.metadata).toHaveBeenCalledWith("verified-owner");expect(verifyToken).toHaveBeenCalledWith("valid-token");expect(response.headers["Cache-Control"]).toContain("no-store");
  });
  it("rejects target-account query parameters",async()=>{
    expect((await request("GET","/api/cloud?action=state&uid=victim")).status).toBe(400);expect(repo.metadata).not.toHaveBeenCalled();
  });
  it("passes a verified account to uploads without trusting body identity",async()=>{
    repo.begin.mockResolvedValue({snapshotId:"test"});const payload={chunkCount:1,expectedRevision:0,hash:"a".repeat(64)};
    const response=await request("POST","/api/cloud?action=begin",payload);expect(response.status).toBe(200);expect(repo.begin).toHaveBeenCalledWith("verified-owner",payload);
  });
  it("rejects cross-origin requests and unsupported methods",async()=>{
    expect((await request("GET","/api/cloud?action=state",undefined,{origin:"https://evil.example"})).status).toBe(403);
    expect((await request("DELETE","/api/cloud?action=state")).status).toBe(405);expect(verifyToken).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and oversized chunks",async()=>{
    expect((await request("POST","/api/cloud?action=chunk","{")).status).toBe(400);
    expect((await request("POST","/api/cloud?action=chunk",{payload:"a".repeat(800001)})).status).toBe(413);expect(repo.upload).not.toHaveBeenCalled();
  });
  it("reports missing server configuration without exposing credentials",async()=>{
    verifyToken.mockRejectedValue(new BackendConfigurationError("Cloud backend is not configured."));const result=await request("GET","/api/cloud?action=state");expect(result.status).toBe(503);expect(result.body.error).toBe("Cloud backend is not configured.");
  });
});
