import { useCloudSync } from "@/hooks/useCloudSync";
import type { AppData } from "@/types";
import { usableAds } from "@/lib/adIntegrity";
import { mergeOrders, mergeEntries, parseBackup } from "@/services/dataIntegrity";
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
  PerOrderReturnCondition,
  DateFilterType,
  DateRange,
} from "@/types";
import {
  createStorage,
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
  loadError: string | null;
  cloudStatus: string;
  cloudSyncError: string | null;
  retryCloudSync: () => void;
  loadCloudVersion: () => Promise<void>;
  enrichedOrders: OrderWithCalculations[];
  returnOverrides: Record<string, PerOrderReturnCondition>;
  dateFilterType: DateFilterType;
  customDateFrom: Date | null;
  customDateTo: Date | null;
  dateRange: DateRange;
  filteredEnrichedOrders: OrderWithCalculations[];
  filteredAds: AdsCostEntry[];
  filteredReferrals: ReferralPayment[];
  filteredCompensations: CompensationEntry[];
  setDateFilterType: (type: DateFilterType) => void;
  setCustomDateRange: (from: Date | null, to: Date | null) => void;
  clearDateFilter: () => void;
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
  setReturnOverride: (
    subOrderNo: string,
    condition: PerOrderReturnCondition | null,
  ) => void;
  clearAllData: () => Promise<void>;
  backupData: () => Promise<string>;
  restoreData: (json: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children, uid }: { children: React.ReactNode; uid: string }) {
  const storage = useMemo(() => createStorage(uid), [uid]);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [returnOverrides, setReturnOverridesState] = useState<
    Record<string, PerOrderReturnCondition>
  >({});
  const [loading, setLoading] = useState(true);
  const [dateFilterType, setDateFilterTypeState] =
    useState<DateFilterType>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | null>(null);
  const [customDateTo, setCustomDateTo] = useState<Date | null>(null);

  const accountData: AppData = useMemo(() => ({ orders, ads, referrals, compensations, skuCosts, gstSettings, userSettings, returnOverrides }), [orders, ads, referrals, compensations, skuCosts, gstSettings, userSettings, returnOverrides]);
  const cloud = useCloudSync(uid, storage, accountData, loading);
  useEffect(() => {
    let active = true;
    void cloud.bootstrap().then(data => {
      if (!active) return;
      setOrders(data.orders); setAds(data.ads.map(ad => usableAds([ad])[0] ?? ad));
      setReferrals(data.referrals); setCompensations(data.compensations);
      setSKUCosts(data.skuCosts); setGSTSettingsState(data.gstSettings);
      setUserSettingsState(data.userSettings); setReturnOverridesState(data.returnOverrides ?? {});
      setLoading(false);
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : "Could not load account data. Check your connection and Firebase setup."); });
    return () => { active = false; };
  }, [cloud.bootstrap]);

  const importParsedData = useCallback(
    async (parsed: ParsedWorkbook, overwrite: boolean) => {
      let mergedOrders = mergeOrders([], parsed.orders);
      let mergedAds = mergeEntries([], parsed.ads);
      let mergedReferrals = mergeEntries([], parsed.referrals);
      let mergedCompensations = mergeEntries([], parsed.compensations);

      if (!overwrite) {
        mergedOrders = mergeOrders(orders, parsed.orders);
        mergedAds = mergeEntries(usableAds(ads), usableAds(parsed.ads));
        mergedReferrals = mergeEntries(referrals, parsed.referrals);
        mergedCompensations = mergeEntries(compensations, parsed.compensations);
      }

      await storage.saveDataset({ orders: mergedOrders, ads: mergedAds, referrals: mergedReferrals, compensations: mergedCompensations });
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

  const setReturnOverride = useCallback(
    (subOrderNo: string, condition: PerOrderReturnCondition | null) => {
      storage.setReturnOverride(subOrderNo, condition);
      setReturnOverridesState((prev) => {
        const next = { ...prev };
        if (condition === null) {
          delete next[subOrderNo];
        } else {
          next[subOrderNo] = condition;
        }
        return next;
      });
    },
    [],
  );

  const clearAllData = useCallback(async () => {
    await storage.clearAllData();
    setOrders([]);
    setAds([]);
    setReferrals([]);
    setCompensations([]);
    setSKUCosts([]);
    setGSTSettingsState({ ...DEFAULT_GST_SETTINGS });
    setUserSettingsState({ ...DEFAULT_USER_SETTINGS });
    setReturnOverridesState({});
  }, []);

  const backupData = useCallback(async () => {
    const data = await storage.exportAllData();
    return JSON.stringify({ ...data, version: 1, exportedAt: new Date().toISOString() }, null, 2);
  }, []);

  const restoreData = useCallback(async (json: string) => {
    const data = parseBackup(json);
    await storage.restoreAllData(data);
    setOrders(data.orders || []);
    setAds(data.ads || []);
    setReferrals(data.referrals || []);
    setCompensations(data.compensations || []);
    setSKUCosts(data.skuCosts || []);
    setGSTSettingsState(data.gstSettings || { ...DEFAULT_GST_SETTINGS });
    setUserSettingsState(data.userSettings || { ...DEFAULT_USER_SETTINGS });
    setReturnOverridesState(data.returnOverrides || {});
  }, []);

  const effectiveRTOSettings = useMemo(() => {
    return {
      ...DEFAULT_USER_SETTINGS.rto,
      ...(userSettings.rto ?? {}),
    };
  }, [userSettings.rto]);

  const effectiveReturnSettings = useMemo(() => {
    return {
      ...DEFAULT_USER_SETTINGS.returnOrder,
      ...(userSettings.returnOrder ?? {}),
    };
  }, [userSettings.returnOrder]);

  const enrichedOrders = useMemo(() => {
    return enrichAllOrders(
      orders,
      skuCosts,
      gstSettings,
      effectiveRTOSettings,
      effectiveReturnSettings,
      returnOverrides,
      usableAds(ads),
      userSettings.adAllocationMethod,
    );
  }, [
    orders,
    skuCosts,
    gstSettings,
    effectiveRTOSettings,
    effectiveReturnSettings,
    returnOverrides,
    ads,
    userSettings.adAllocationMethod,
  ]);

  const dateRange = useMemo((): DateRange => {
    const now = new Date();
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const endOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };

    switch (dateFilterType) {
      case "all":
        return { start: null, end: null };
      case "today": {
        const d = startOfDay(now);
        return { start: d, end: endOfDay(d) };
      }
      case "thisWeek": {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { start: startOfDay(monday), end: endOfDay(sunday) };
      }
      case "lastWeek": {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const thisMonday = new Date(d);
        thisMonday.setDate(d.getDate() + diff);
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday);
        lastSunday.setDate(thisMonday.getDate() - 1);
        return { start: startOfDay(lastMonday), end: endOfDay(lastSunday) };
      }
      case "thisMonth": {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: startOfDay(first), end: endOfDay(last) };
      }
      case "lastMonth": {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: startOfDay(first), end: endOfDay(last) };
      }
      case "custom":
        return {
          start: customDateFrom ? startOfDay(customDateFrom) : null,
          end: customDateTo ? endOfDay(customDateTo) : null,
        };
      default:
        return { start: null, end: null };
    }
  }, [dateFilterType, customDateFrom, customDateTo]);

  const isDateInRange = useCallback(
    (d: Date | null | undefined): boolean => {
      if (!d) return dateRange.start === null && dateRange.end === null;
      const { start, end } = dateRange;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    },
    [dateRange],
  );

  const filteredEnrichedOrders = useMemo(() => {
    if (dateRange.start === null && dateRange.end === null) {
      return enrichedOrders;
    }
    return enrichedOrders.filter((o) => isDateInRange(o.orderDate));
  }, [enrichedOrders, dateRange, isDateInRange]);

  const filteredAds = useMemo(() => {
    if (dateRange.start === null && dateRange.end === null) {
      return usableAds(ads);
    }
    return usableAds(ads).filter((a) => isDateInRange(a.deductionDate));
  }, [ads, dateRange, isDateInRange]);

  const filteredReferrals = useMemo(() => {
    if (dateRange.start === null && dateRange.end === null) {
      return referrals;
    }
    return referrals.filter((r) => isDateInRange(r.date));
  }, [referrals, dateRange, isDateInRange]);

  const filteredCompensations = useMemo(() => {
    if (dateRange.start === null && dateRange.end === null) {
      return compensations;
    }
    return compensations.filter((c) => isDateInRange(c.date));
  }, [compensations, dateRange, isDateInRange]);

  const setDateFilterType = useCallback((type: DateFilterType) => {
    setDateFilterTypeState(type);
  }, []);

  const setCustomDateRange = useCallback(
    (from: Date | null, to: Date | null) => {
      setCustomDateFrom(from);
      setCustomDateTo(to);
      setDateFilterTypeState("custom");
    },
    [],
  );

  const clearDateFilter = useCallback(() => {
    setDateFilterTypeState("all");
    setCustomDateFrom(null);
    setCustomDateTo(null);
  }, []);

  const value: AppContextValue = {
    orders,
    ads,
    referrals,
    compensations,
    skuCosts,
    gstSettings,
    userSettings,
    loading,
    loadError,
    cloudStatus: cloud.status,
    cloudSyncError: cloud.error,
    retryCloudSync: cloud.retry,
    loadCloudVersion: cloud.loadCloudVersion,
    enrichedOrders,
    returnOverrides,
    dateFilterType,
    customDateFrom,
    customDateTo,
    dateRange,
    filteredEnrichedOrders,
    filteredAds,
    filteredReferrals,
    filteredCompensations,
    setDateFilterType,
    setCustomDateRange,
    clearDateFilter,
    importParsedData,
    setSKUCost,
    bulkSetSKUCosts,
    deleteSKUCost,
    setGSTSettings,
    setUserSettings,
    setAdAllocationMethod,
    setReturnOverride,
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
