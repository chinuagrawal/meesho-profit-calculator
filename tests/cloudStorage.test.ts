import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import { accountFixture } from "./accountDataFixture";
import { splitSnapshot,snapshotHash } from "@/lib/cloudSnapshot";
const state=vi.hoisted(()=>({uid:"owner",token:vi.fn()}));
vi.mock("@/config/firebase",()=>({auth:{get currentUser(){return {uid:state.uid,getIdToken:state.token};}}}));
import { CloudConflictError,loadCloudData,saveCloudData } from "@/services/cloudStorage";
let fetchMock:ReturnType<typeof vi.fn>;
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
beforeEach(()=>{state.uid="owner";state.token.mockReset().mockResolvedValue("token");fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);vi.stubGlobal("window",{setTimeout,clearTimeout});});
afterEach(()=>vi.unstubAllGlobals());
describe("authenticated cloud API client",()=>{
  it("loads existing snapshots using authenticated backend requests",async()=>{
    const chunks=splitSnapshot(accountFixture());const hash=await snapshotHash(chunks.join(""));
    fetchMock.mockResolvedValueOnce(reply({state:{version:1,revision:1,snapshotId:"existing-snapshot",chunkCount:1,hash}})).mockResolvedValueOnce(reply({payload:chunks[0]}));
    expect((await loadCloudData("owner"))?.data).toEqual(accountFixture());expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token");expect(fetchMock.mock.calls[0][0]).not.toContain("owner");
  });
  it("uploads chunks and commits through the API, not Firestore",async()=>{
    const hash=await snapshotHash(splitSnapshot(accountFixture()).join(""));
    fetchMock.mockResolvedValueOnce(reply({snapshotId:"new-snapshot"})).mockResolvedValueOnce(reply({ok:true})).mockResolvedValueOnce(reply({revision:1,hash}));
    expect((await saveCloudData("owner",accountFixture(),0)).revision).toBe(1);expect(fetchMock.mock.calls.map(call=>call[0])).toEqual(["/api/cloud?action=begin","/api/cloud?action=chunk","/api/cloud?action=commit"]);
  });
  it("refreshes expired tokens once without retry loops",async()=>{
    fetchMock.mockResolvedValueOnce(reply({error:"expired"},401)).mockResolvedValueOnce(reply({state:null}));expect(await loadCloudData("owner")).toBeNull();expect(state.token).toHaveBeenCalledWith(true);expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("pauses for revision conflicts and preserves backend setup errors",async()=>{
    fetchMock.mockResolvedValueOnce(reply({error:"Newer data exists"},409));await expect(saveCloudData("owner",accountFixture(),0)).rejects.toBeInstanceOf(CloudConflictError);
    fetchMock.mockResolvedValueOnce(reply({error:"Set server credentials"},503));await expect(loadCloudData("owner")).rejects.toThrow("Set server credentials");
  });
  it("does not access data after authentication switches accounts",async()=>{state.uid="other";await expect(loadCloudData("owner")).rejects.toThrow("login changed");expect(fetchMock).not.toHaveBeenCalled();});
  it("reports a server cold-start failure without calling it a missing deployment",async()=>{
    fetchMock.mockResolvedValueOnce(new Response("FUNCTION_INVOCATION_FAILED",{status:500}));
    await expect(loadCloudData("owner")).rejects.toThrow("server error 500");
  });
  it("detects altered cloud chunks",async()=>{
    const hash=await snapshotHash(splitSnapshot(accountFixture()).join(""));fetchMock.mockResolvedValueOnce(reply({state:{version:1,revision:1,snapshotId:"existing",chunkCount:1,hash}})).mockResolvedValueOnce(reply({payload:"tampered"}));await expect(loadCloudData("owner")).rejects.toThrow("integrity");
  });
});
