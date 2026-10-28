import { readFileSync } from "node:fs";
import { afterAll,beforeAll,describe,it } from "vitest";
import { initializeTestEnvironment,assertFails,type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc,getDoc,setDoc } from "firebase/firestore";
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("server-only Firestore access",()=>{
  let env:RulesTestEnvironment;
  beforeAll(async()=>{env=await initializeTestEnvironment({projectId:"demo-meesho-profit",firestore:{rules:readFileSync("firestore.rules","utf8")}});},30000);
  afterAll(async()=>{await env?.cleanup();});
  it("denies direct browser access even to its own account",async()=>{
    const owner=env.authenticatedContext("owner").firestore();await assertFails(getDoc(doc(owner,"users/owner/calculator/state")));await assertFails(setDoc(doc(owner,"users/owner/calculator/state"),{revision:1}));
  });
  it("denies other-account and unauthenticated access",async()=>{
    const other=env.authenticatedContext("other").firestore();const anonymous=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(other,"users/owner/calculator/state")));await assertFails(getDoc(doc(anonymous,"users/owner/calculator/state")));
  });
  it("denies bypassing the API through snapshot paths",async()=>{
    const owner=env.authenticatedContext("owner").firestore();await assertFails(setDoc(doc(owner,"users/owner/snapshots/test/chunks/0"),{payload:"bypass"}));await assertFails(setDoc(doc(owner,"users/owner/uploads/test"),{committed:true}));
  });
});
