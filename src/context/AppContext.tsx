import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Order,
  AdsCostEntry,
  ReferralPayment,
  CompensationEntry,
  SKUCost,
  GSTSettings,
  UserSettings,
  OrderWithCalculations,
  AdAllocationMethod,
  ParsedWorkbook,
} from "@/types";
import {
  storage,
  DEFAULT_GST_SETTINGS,
  DEFAULT_USER_SETTINGS,
} from "@/services/storage";
import { enrichAllOrders } from "@/calculations";

interface AppContextValue {
  orders: Order[];
  ads: AdsCostEntry[];
  referrals: ReferralPayment[];
  compensations: CompensationEntry[];
  skuCosts: SKUCost[];
  gstSettings: GSTSettings;
  userSettings: UserSettings;
  loading: boolean;
  enrichedOrders: OrderWithCalculations[];
  importParsedData: (
    parsed: ParsedWorkbook,
    overwrite: boolean,
  ) => Promise<void>;
  setSKUCost: (
    supplierSKU: string,
    costInclGST: number | null,
    gstRate?: number,
    productName?: string,
  ) => void;
  bulkSetSKUCosts: (
    costs: {
      supplierSKU: string;
      purchaseCostInclGST: number | null;
      gstRate?: number;
      productName?: string;
    }[],
  ) => void;
  deleteSKUCost: (supplierSKU: string) => void;
  setGSTSettings: (settings: GSTSettings) => void;
  setUserSettings: (settings: UserSettings) => void;
  setAdAllocationMethod: (method: AdAllocationMethod) => void;
  clearAllData: () => Promise<void>;
  backupData: () => Promise<string>;
  restoreData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ads, setAds] = useState<AdsCostEntry[]>([]);
  const [referrals, setReferrals] = useState<ReferralPayment[]>([]);
  const [compensations, setCompensations] = useState<CompensationEntry[]>([]);
  const [skuCosts, setSKUCosts] = useState<SKUCost[]>([]);
  const [gstSettings, setGSTSettingsState] =
    useState<GSTSettings>(DEFAULT_GST_SETTINGS);
  const [userSettings, setUserSettingsState] = useState<UserSettings>(
    DEFAULT_USER_SETTINGS,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, a, r, c] = await Promise.all([
          storage.getAllOrders(),
          storage.getAllAds(),
          storage.getAllReferrals(),
          storage.getAllCompensations(),
        ]);
        setOrders(o);
        setAds(a);
        setReferrals(r);
        setCompensations(c);
      } catch (err) {
        console.error("Failed to load data from IndexedDB", err);
      }
      setSKUCosts(storage.getSKUCosts());
      setGSTSettingsState(storage.getGSTSettings());
      setUserSettingsState(storage.getUserSettings());
      setLoading(false);
    })();
  }, []);

  const importParsedData = useCallback(
    async (parsed: ParsedWorkbook, overwrite: boolean) => {
      let mergedOrders = parsed.orders;
      let mergedAds = parsed.ads;
      let mergedReferrals = parsed.referrals;
      let mergedCompensations = parsed.compensations;

      if (!overwrite) {
        const existingSubOrderNos = new Set(
          orders.map((o) => o.subOrderNo).filter(Boolean),
        );
        const existingOrderIds = new Set(orders.map((o) => o.id));
        mergedOrders = [
          ...orders,
          ...parsed.orders.filter(
            (o) =>
              !(o.subOrderNo && existingSubOrderNos.has(o.subOrderNo)) &&
              !existingOrderIds.has(o.id),
          ),
        ];
        mergedAds = [...ads, ...parsed.ads];
        mergedReferrals = [...referrals, ...parsed.referrals];
        mergedCompensations = [...compensations, ...parsed.compensations];
      }

      await Promise.all([
        storage.saveOrders(mergedOrders, true),
        storage.saveAds(mergedAds, true),
        storage.saveReferrals(mergedReferrals, true),
        storage.saveCompensations(mergedCompensations, true),
      ]);
      setOrders(mergedOrders);
      setAds(mergedAds);
      setReferrals(mergedReferrals);
      setCompensations(mergedCompensations);

      const existingSKUMap = new Map(skuCosts.map((s) => [s.supplierSKU, s]));
      const newSKUs: SKUCost[] = [];
      const now = new Date().toISOString();
      const uniqueFromOrders = new Map<string, string>();
      parsed.orders.forEach((o) => {
        if (o.supplierSKU)
          uniqueFromOrders.set(o.supplierSKU, o.productName || o.supplierSKU);
      });
      for (const [sku, productName] of uniqueFromOrders.entries()) {
        if (!existingSKUMap.has(sku)) {
          newSKUs.push({
            supplierSKU: sku,
            productName,
            purchaseCostInclGST: null,
            gstRate: gstSettings.purchaseGSTRate,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      if (newSKUs.length > 0) {
        const mergedSKUs = [...skuCosts, ...newSKUs];
        storage.saveSKUCosts(mergedSKUs);
        setSKUCosts(mergedSKUs);
      }
    },
    [orders, ads, referrals, compensations, skuCosts, gstSettings],
  );

  const setSKUCost = useCallback(
    (
      supplierSKU: string,
      costInclGST: number | null,
      gstRate?: number,
      productName?: string,
    ) => {
      const now = new Date().toISOString();
      setSKUCosts((prev) => {
        const idx = prev.findIndex((s) => s.supplierSKU === supplierSKU);
        let next: SKUCost[];
        if (idx >= 0) {
          const existing = prev[idx];
          next = prev.slice();
          next[idx] = {
            ...existing,
            purchaseCostInclGST: costInclGST,
            gstRate: gstRate ?? existing.gstRate ?? gstSettings.purchaseGSTRate,
            productName: productName ?? existing.productName,
            updatedAt: now,
          };
        } else {
          next = [
            ...prev,
            {
              supplierSKU,
              productName,
              purchaseCostInclGST: costInclGST,
              gstRate: gstRate ?? gstSettings.purchaseGSTRate,
              createdAt: now,
              updatedAt: now,
            },
          ];
        }
        storage.saveSKUCosts(next);
        return next;
      });
    },
    [gstSettings],
  );

  const bulkSetSKUCosts = useCallback(
    (
      costs: {
        supplierSKU: string;
        purchaseCostInclGST: number | null;
        gstRate?: number;
        productName?: string;
      }[],
    ) => {
      const now = new Date().toISOString();
      setSKUCosts((prev) => {
        const map = new Map(prev.map((s) => [s.supplierSKU, { ...s }]));
        for (const c of costs) {
          const existing = map.get(c.supplierSKU);
          if (existing) {
            existing.purchaseCostInclGST = c.purchaseCostInclGST;
            existing.gstRate =
              c.gstRate ?? existing.gstRate ?? gstSettings.purchaseGSTRate;
            existing.productName = c.productName ?? existing.productName;
            existing.updatedAt = now;
          } else {
            map.set(c.supplierSKU, {
              supplierSKU: c.supplierSKU,
              productName: c.productName,
              purchaseCostInclGST: c.purchaseCostInclGST,
              gstRate: c.gstRate ?? gstSettings.purchaseGSTRate,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
        const next = Array.from(map.values());
        storage.saveSKUCosts(next);
        return next;
      });
    },
    [gstSettings],
  );

  const deleteSKUCost = useCallback((supplierSKU: string) => {
    setSKUCosts((prev) => {
      const next = prev.filter((s) => s.supplierSKU !== supplierSKU);
      storage.saveSKUCosts(next);
      return next;
    });
  }, []);

  const setGSTSettings = useCallback((settings: GSTSettings) => {
    storage.saveGSTSettings(settings);
    setGSTSettingsState(settings);
  }, []);

  const setUserSettings = useCallback((settings: UserSettings) => {
    storage.saveUserSettings(settings);
    setUserSettingsState(settings);
  }, []);

  const setAdAllocationMethod = useCallback((method: AdAllocationMethod) => {
    setUserSettingsState((prev) => {
      const next = { ...prev, adAllocationMethod: method };
      storage.saveUserSettings(next);
      return next;
    });
  }, []);

  const clearAllData = useCallback(async () => {
    await storage.clearAllData();
    setOrders([]);
    setAds([]);
    setReferrals([]);
    setCompensations([]);
    setSKUCosts([]);
    setGSTSettingsState({ ...DEFAULT_GST_SETTINGS });
    setUserSettingsState({ ...DEFAULT_USER_SETTINGS });
  }, []);

  const backupData = useCallback(async () => {
    const data = await storage.exportAllData();
    return JSON.stringify(data, null, 2);
  }, []);

  const restoreData = useCallback(async (json: string) => {
    const data = JSON.parse(json);
    await storage.restoreAllData(data);
    setOrders(data.orders || []);
    setAds(data.ads || []);
    setReferrals(data.referrals || []);
    setCompensations(data.compensations || []);
    setSKUCosts(data.skuCosts || []);
    setGSTSettingsState(data.gstSettings || { ...DEFAULT_GST_SETTINGS });
    setUserSettingsState(data.userSettings || { ...DEFAULT_USER_SETTINGS });
  }, []);

  const effectiveRTOSettings = useMemo(() => {
    return {
      ...DEFAULT_USER_SETTINGS.rto,
      ...(userSettings.rto ?? {}),
    };
  }, [userSettings.rto]);

  const enrichedOrders = useMemo(() => {
    return enrichAllOrders(
      orders,
      skuCosts,
      gstSettings,
      effectiveRTOSettings,
      ads,
      userSettings.adAllocationMethod,
    );
  }, [orders, skuCosts, gstSettings, effectiveRTOSettings, ads, userSettings.adAllocationMethod]);

  const value: AppContextValue = {
    orders,
    ads,
    referrals,
    compensations,
    skuCosts,
    gstSettings,
    userSettings,
    loading,
    enrichedOrders,
    importParsedData,
    setSKUCost,
    bulkSetSKUCosts,
    deleteSKUCost,
    setGSTSettings,
    setUserSettings,
    setAdAllocationMethod,
    clearAllData,
    backupData,
    restoreData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
