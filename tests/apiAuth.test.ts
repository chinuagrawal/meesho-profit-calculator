import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import { beforeEach,expect,it,vi } from "vitest";
const calls=vi.hoisted(()=>({verify:vi.fn(),metadata:vi.fn()}));
vi.mock("../server/firebaseAdmin",()=>({getAdminServices:()=>({auth:{verifyIdToken:calls.verify},db:{}})}));
vi.mock("../server/cloudRepository",async(importOriginal)=>{
  const original=await importOriginal<typeof import("../server/cloudRepository")>();
  return {...original,createCloudRepository:()=>({metadata:calls.metadata})};
});
import handler from "../api/cloud";
import type { ApiRequest } from "../server/cloudHandler";
beforeEach(()=>{vi.resetAllMocks();calls.verify.mockResolvedValue({uid:"server-verified-user"});calls.metadata.mockResolvedValue(null);});
it("verifies revocation and scopes the real API entrypoint to the verified UID",async()=>{
  const request=Readable.from([]) as ApiRequest;request.method="GET";request.url="/api/cloud?action=state";request.headers={host:"app.example",authorization:"Bearer token"};
  const response={statusCode:200,setHeader:vi.fn(),end:vi.fn()};
  await handler(request,response as unknown as ServerResponse);
  expect(calls.verify).toHaveBeenCalledWith("token",true);expect(calls.metadata).toHaveBeenCalledWith("server-verified-user");expect(response.statusCode).toBe(200);
});
