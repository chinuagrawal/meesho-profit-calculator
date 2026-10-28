import type { AppData } from "@/types";
import { DEFAULT_GST_SETTINGS, DEFAULT_USER_SETTINGS } from "@/services/storage";
export function accountFixture(): AppData {
  return { orders: [{ id: "order-1", subOrderNo: "sub-1", orderDate: new Date("2026-10-01T00:00:00Z"), supplierSKU: "A", productName: "Product", quantity: 1, liveOrderStatus: "Delivered", rawStatus: "Delivered", finalSettlementAmount: 200, meeshoFees: {}, rawFields: {}, importedAt: "2026-10-01" }], ads: [], referrals: [], compensations: [], skuCosts: [], gstSettings: { ...DEFAULT_GST_SETTINGS }, userSettings: structuredClone(DEFAULT_USER_SETTINGS), returnOverrides: {} };
}
