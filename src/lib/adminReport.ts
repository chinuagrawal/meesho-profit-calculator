import type { AppData } from "@/types";
import { aggregateByMonth, aggregateBySKU, enrichAllOrders } from "@/calculations";
import { usableAds } from "@/lib/adIntegrity";
import { DEFAULT_USER_SETTINGS } from "@/services/storage";

export function buildAdminReport(data: AppData) {
  const ads = usableAds(data.ads);
  const orders = enrichAllOrders(data.orders, data.skuCosts, data.gstSettings,
    { ...DEFAULT_USER_SETTINGS.rto, ...data.userSettings.rto },
    { ...DEFAULT_USER_SETTINGS.returnOrder, ...data.userSettings.returnOrder },
    data.returnOverrides ?? {}, ads, data.userSettings.adAllocationMethod);
  const settlement = orders.reduce((sum, row) => sum + (row.finalSettlementAmount ?? 0), 0);
  const purchaseCost = orders.reduce((sum, row) => sum + (row.actualPurchaseAmountPaid ?? 0), 0);
  const adSpend = ads.reduce((sum, row) => sum + (row.totalAdsCost ?? row.adCost ?? 0), 0);
  const profit = orders.reduce((sum, row) => sum + (row.basicCashProfit ?? 0), 0) - adSpend;
  return { orders, months: aggregateByMonth(orders, ads), skus: aggregateBySKU(orders), settlement, purchaseCost, adSpend, profit,
    missingProfit: orders.filter(row => row.basicCashProfit === null).length,
    malformedAds: data.ads.length - ads.length,
    outputGST: orders.reduce((sum, row) => sum + (row.outputGST ?? 0), 0),
    inputGST: orders.reduce((sum, row) => sum + (row.totalInputGST ?? 0), 0),
  };
}
