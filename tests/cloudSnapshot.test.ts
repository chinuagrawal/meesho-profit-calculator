import { afterEach, describe, it, expect, vi } from "vitest";
import { normalizePhone, authError } from "@/lib/authHelpers";
import { splitSnapshot, snapshotHash, SNAPSHOT_CHARS, readSyncMarker, writeSyncMarker } from "@/lib/cloudSnapshot";
import { parseBackup } from "@/services/dataIntegrity";
import { accountFixture } from "./accountDataFixture";
afterEach(() => vi.unstubAllGlobals());
describe("phone authentication inputs", () => {
  it("normalizes Indian phone numbers without dropping international prefixes", () => { expect(normalizePhone("98765 43210")).toBe("+919876543210"); expect(normalizePhone("+1 (202) 555-0101")).toBe("+12025550101"); });
  it.each(["", "123", "abc9876543210", "++919876543210"])("rejects invalid input %s", value => expect(() => normalizePhone(value)).toThrow());
  it("explains wrong codes, quotas and setup errors", () => { expect(authError({code:"auth/invalid-verification-code"})).toContain("incorrect"); expect(authError({code:"auth/quota-exceeded"})).toContain("billing"); expect(authError({code:"auth/unauthorized-domain"})).toContain("domain"); });
});
describe("cloud snapshot integrity", () => {
  it("round-trips dates and data", () => { const data = accountFixture(); const json = splitSnapshot(data).join(""); expect(parseBackup(json)).toEqual(data); });
  it("splits large data safely without breaking Unicode characters", () => {
    const data = accountFixture(); data.orders[0].rawFields = {note: "😀".repeat(SNAPSHOT_CHARS)};
    const chunks = splitSnapshot(data); expect(chunks.length).toBeGreaterThan(1); expect(chunks.every(chunk => chunk.length <= SNAPSHOT_CHARS)).toBe(true);
    expect(chunks.map(chunk => new TextDecoder().decode(new TextEncoder().encode(chunk))).join("")).toBe(chunks.join(""));
    expect(parseBackup(chunks.join(""))).toEqual(data);
  });
  it("detects even small changes with checksums", async () => { expect(await snapshotHash("same")).toBe(await snapshotHash("same")); expect(await snapshotHash("same")).not.toBe(await snapshotHash("changed")); });
  it("rejects invalid data before creating an upload", () => { const data = accountFixture(); data.orders[0].quantity = 0; expect(() => splitSnapshot(data)).toThrow(); });
  it("isolates pending markers between accounts", () => {
    const values = new Map(); vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    writeSyncMarker("A", {revision: 1, dirty: true, hash:"a"}); expect(readSyncMarker("B")).toBeNull(); expect(readSyncMarker("A")?.dirty).toBe(true);
  });
});
