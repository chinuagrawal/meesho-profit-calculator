import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { createCloudRepository } from "../server/cloudRepository";
import { splitSnapshot } from "@/lib/cloudSnapshot";
import { accountFixture } from "./accountDataFixture";
const docs=new Map<string,Record<string,any>>();
const snapshot=(path:string)=>({exists:docs.has(path),data:()=>docs.get(path)});
const db={
  doc:(path:string)=>({path,get:async()=>snapshot(path),create:async(data:Record<string,unknown>)=>{if(docs.has(path))throw new Error("exists");docs.set(path,data);}}),
  getAll:async(...refs:{path:string}[])=>refs.map(ref=>snapshot(ref.path)),
  runTransaction:async(run:(transaction:any)=>Promise<void>)=>{
    const writes:(()=>void)[]=[];
    await run({get:async(ref:{path:string})=>snapshot(ref.path),create:(ref:{path:string},data:Record<string,unknown>)=>writes.push(()=>docs.set(ref.path,data)),set:(ref:{path:string},data:Record<string,unknown>)=>writes.push(()=>docs.set(ref.path,data)),update:(ref:{path:string},data:Record<string,unknown>)=>writes.push(()=>docs.set(ref.path,{...docs.get(ref.path),...data}))});writes.forEach(write=>write());
  },
};
const repository=createCloudRepository(db as unknown as Firestore);
async function upload(uid="owner",revision=0,json=splitSnapshot(accountFixture()).join("")){
  const hash=createHash("sha256").update(json).digest("hex");
  const session=await repository.begin(uid,{expectedRevision:revision,chunkCount:1,hash});
  await repository.upload(uid,{snapshotId:session.snapshotId,index:0,payload:json});return session.snapshotId;
}
beforeEach(()=>docs.clear());
describe("server-owned snapshot storage",()=>{
  it("keeps complete snapshots compatible with the existing schema",async()=>{
    const id=await upload();expect((await repository.commit("owner",{snapshotId:id})).revision).toBe(1);
    expect((await repository.metadata("owner"))?.snapshotId).toBe(id);expect((await repository.chunk("owner",id,"0")).payload).toContain("order-1");
  });
  it("never crosses account paths even with another account's snapshot ID",async()=>{
    const id=await upload();await repository.commit("owner",{snapshotId:id});expect(await repository.metadata("other")).toBeNull();await expect(repository.chunk("other",id,"0")).rejects.toMatchObject({status:404});await expect(repository.commit("other",{snapshotId:id})).rejects.toMatchObject({status:409});
  });
  it("checks revision again when committing concurrent uploads",async()=>{
    const first=await upload();const stale=await upload();await repository.commit("owner",{snapshotId:first});await expect(repository.commit("owner",{snapshotId:stale})).rejects.toMatchObject({status:409});expect((await repository.metadata("owner"))?.snapshotId).toBe(first);
  });
  it("refuses corrupted or invalid data without changing the active copy",async()=>{
    const invalid=await upload("owner",0,"{}");await expect(repository.commit("owner",{snapshotId:invalid})).rejects.toMatchObject({status:400});expect(await repository.metadata("owner")).toBeNull();
    const id=await upload();docs.set(`users/owner/snapshots/${id}/chunks/0`,{payload:"modified"});await expect(repository.commit("owner",{snapshotId:id})).rejects.toMatchObject({status:400});expect(await repository.metadata("owner")).toBeNull();
  });
  it("rejects forged account fields, path traversal and excessive sizes",async()=>{
    await expect(repository.begin("owner",{expectedRevision:0,chunkCount:1,hash:"a".repeat(64),uid:"victim"})).rejects.toMatchObject({status:400});
    await expect(repository.chunk("owner","../victim","0")).rejects.toMatchObject({status:400});
    const id=await upload();await expect(repository.upload("owner",{snapshotId:id,index:0,payload:"a".repeat(150001)})).rejects.toMatchObject({status:400});
  });
  it("expires abandoned uploads and keeps chunks immutable",async()=>{
    const id=await upload();await expect(repository.upload("owner",{snapshotId:id,index:0,payload:"different"})).rejects.toMatchObject({status:409});
    const key=`users/owner/uploads/${id}`;docs.set(key,{...docs.get(key),createdAt:Timestamp.fromMillis(Date.now()-16*60*1000)});await expect(repository.commit("owner",{snapshotId:id})).rejects.toMatchObject({status:409});
  });
});
