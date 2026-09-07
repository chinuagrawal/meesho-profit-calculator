import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Order, AdsCostEntry, ReferralPayment, CompensationEntry, SKUCost, GSTSettings, UserSettings, AppData } from "@/types";

interface MeeshoDB extends DBSchema {
  orders: {
    key: string;
    value: Order;
    indexes: { "by-subOrderNo": string; "by-sku": string };
  };
  ads: {
    key: string;
    value: AdsCostEntry;
  };
  referrals: {
    key: string;
    value: ReferralPayment;
  };
  compensations: {
    key: string;
    value: CompensationEntry;
  };
}

const DB_NAME = "meesho-profit-calculator";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MeeshoDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MeeshoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("orders")) {
          const ordersStore = db.createObjectStore("orders", { keyPath: "id" });
          ordersStore.createIndex("by-subOrderNo", "subOrderNo", { unique: false });
          ordersStore.createIndex("by-sku", "supplierSKU", { unique: false });
        }
        if (!db.objectStoreNames.contains("ads")) {
          db.createObjectStore("ads", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("referrals")) {
          db.createObjectStore("referrals", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("compensations")) {
          db.createObjectStore("compensations", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

const LS_SKU_COSTS = "mpc_sku_costs";
const LS_GST_SETTINGS = "mpc_gst_settings";
const LS_USER_SETTINGS = "mpc_user_settings";

export const DEFAULT_GST_SETTINGS: GSTSettings = {
  gstRegistered: true,
  purchaseGSTRate: 18,
  sellingGSTRate: 18,
  itcEligible: true,
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  currency: "INR",
  adAllocationMethod: "none",
  defaultProfitView: "cash",
  decimalPlaces: 2,
  rto: {
    rtoShippingCost: 0,
    chargeProductCostOnRTO: true,
  },
};

export const storage = {
  async getAllOrders(): Promise<Order[]> {
    const db = await getDB();
    return db.getAll("orders");
  },

  async saveOrders(orders: Order[], overwrite = false): Promise<number> {
    const db = await getDB();
    const tx = db.transaction("orders", "readwrite");
    if (overwrite) await tx.store.clear();
    let count = 0;
    for (const order of orders) {
      await tx.store.put(order);
      count++;
    }
    await tx.done;
    return count;
  },

  async clearOrders(): Promise<void> {
    const db = await getDB();
    await db.clear("orders");
  },

  async getAllAds(): Promise<AdsCostEntry[]> {
    const db = await getDB();
    return db.getAll("ads");
  },

  async saveAds(entries: AdsCostEntry[], overwrite = false): Promise<number> {
    const db = await getDB();
    const tx = db.transaction("ads", "readwrite");
    if (overwrite) await tx.store.clear();
    let count = 0;
    for (const e of entries) {
      await tx.store.put(e);
      count++;
    }
    await tx.done;
    return count;
  },

  async clearAds(): Promise<void> {
    const db = await getDB();
    await db.clear("ads");
  },

  async getAllReferrals(): Promise<ReferralPayment[]> {
    const db = await getDB();
    return db.getAll("referrals");
  },

  async saveReferrals(entries: ReferralPayment[], overwrite = false): Promise<number> {
    const db = await getDB();
    const tx = db.transaction("referrals", "readwrite");
    if (overwrite) await tx.store.clear();
    let count = 0;
    for (const e of entries) {
      await tx.store.put(e);
      count++;
    }
    await tx.done;
    return count;
  },

  async clearReferrals(): Promise<void> {
    const db = await getDB();
    await db.clear("referrals");
  },

  async getAllCompensations(): Promise<CompensationEntry[]> {
    const db = await getDB();
    return db.getAll("compensations");
  },

  async saveCompensations(entries: CompensationEntry[], overwrite = false): Promise<number> {
    const db = await getDB();
    const tx = db.transaction("compensations", "readwrite");
    if (overwrite) await tx.store.clear();
    let count = 0;
    for (const e of entries) {
      await tx.store.put(e);
      count++;
    }
    await tx.done;
    return count;
  },

  async clearCompensations(): Promise<void> {
    const db = await getDB();
    await db.clear("compensations");
  },

  getSKUCosts(): SKUCost[] {
    try {
      const raw = localStorage.getItem(LS_SKU_COSTS);
      if (!raw) return [];
      return JSON.parse(raw) as SKUCost[];
    } catch {
      return [];
    }
  },

  saveSKUCosts(costs: SKUCost[]): void {
    localStorage.setItem(LS_SKU_COSTS, JSON.stringify(costs));
  },

  getGSTSettings(): GSTSettings {
    try {
      const raw = localStorage.getItem(LS_GST_SETTINGS);
      if (!raw) return { ...DEFAULT_GST_SETTINGS };
      return { ...DEFAULT_GST_SETTINGS, ...(JSON.parse(raw) as GSTSettings) };
    } catch {
      return { ...DEFAULT_GST_SETTINGS };
    }
  },

  saveGSTSettings(settings: GSTSettings): void {
    localStorage.setItem(LS_GST_SETTINGS, JSON.stringify(settings));
  },

  getUserSettings(): UserSettings {
    try {
      const raw = localStorage.getItem(LS_USER_SETTINGS);
      if (!raw) return { ...DEFAULT_USER_SETTINGS };
      return { ...DEFAULT_USER_SETTINGS, ...(JSON.parse(raw) as UserSettings) };
    } catch {
      return { ...DEFAULT_USER_SETTINGS };
    }
  },

  saveUserSettings(settings: UserSettings): void {
    localStorage.setItem(LS_USER_SETTINGS, JSON.stringify(settings));
  },

  async exportAllData(): Promise<AppData> {
    const [orders, ads, referrals, compensations] = await Promise.all([
      this.getAllOrders(),
      this.getAllAds(),
      this.getAllReferrals(),
      this.getAllCompensations(),
    ]);
    return {
      orders,
      ads,
      referrals,
      compensations,
      skuCosts: this.getSKUCosts(),
      gstSettings: this.getGSTSettings(),
      userSettings: this.getUserSettings(),
    };
  },

  async restoreAllData(data: AppData): Promise<void> {
    await Promise.all([
      this.saveOrders(data.orders || [], true),
      this.saveAds(data.ads || [], true),
      this.saveReferrals(data.referrals || [], true),
      this.saveCompensations(data.compensations || [], true),
    ]);
    if (data.skuCosts) this.saveSKUCosts(data.skuCosts);
    if (data.gstSettings) this.saveGSTSettings(data.gstSettings);
    if (data.userSettings) this.saveUserSettings(data.userSettings);
  },

  async clearAllData(): Promise<void> {
    await Promise.all([
      this.clearOrders(),
      this.clearAds(),
      this.clearReferrals(),
      this.clearCompensations(),
    ]);
    localStorage.removeItem(LS_SKU_COSTS);
    localStorage.removeItem(LS_GST_SETTINGS);
    localStorage.removeItem(LS_USER_SETTINGS);
  },
};
