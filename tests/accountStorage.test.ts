import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createStorage } from "@/services/storage";
import { accountFixture } from "./accountDataFixture";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}, removeItem: (key: string) => {values.delete(key);} });
});
afterEach(() => vi.unstubAllGlobals());
describe("account storage isolation", () => {
  it("never shares records or settings across UIDs or legacy storage", async () => {
    const a = createStorage("test-a"), b = createStorage("test-b"), legacy = createStorage();
    await a.restoreAllData(accountFixture());
    a.saveSKUCosts([{supplierSKU:"A",purchaseCostInclGST:80,gstRate:18,createdAt:"",updatedAt:""}]);
    a.setReturnOverride("sub-1", "damaged");
    expect(await b.getAllOrders()).toEqual([]); expect(b.getSKUCosts()).toEqual([]); expect(b.getReturnOverrides()).toEqual({});
    expect(await legacy.getAllOrders()).toEqual([]); expect(legacy.getSKUCosts()).toEqual([]);
    expect((await a.getAllOrders())[0].orderDate).toBeInstanceOf(Date);
    expect(a.getReturnOverrides()).toEqual({"sub-1":"damaged"});
  });
  it("clears only the selected account", async () => {
    const a = createStorage("clear-a"), b = createStorage("clear-b");
    await a.restoreAllData(accountFixture()); await b.restoreAllData(accountFixture()); await a.clearAllData();
    expect(await a.getAllOrders()).toEqual([]); expect(await b.getAllOrders()).toHaveLength(1);
  });
});
