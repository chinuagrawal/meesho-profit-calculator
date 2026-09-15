export type OrderStatus =
  | "Delivered"
  | "Shipped"
  | "Cancelled"
  | "Returned"
  | "RTO"
  | "Pending"
  | "Other";

export type AdAllocationMethod =
  | "none"
  | "equal"
  | "byOrderValue"
  | "byQuantity";

export type ProfitView = "cash" | "accounting" | "net";

export type ReturnProductCondition = "usable" | "damaged" | "manual";

export type PerOrderReturnCondition = "usable" | "damaged";

export type CalculationStatus =
  | "PROFIT"
  | "LOSS"
  | "RTO"
  | "CANCELLED"
  | "COST_MISSING"
  | "REVIEW_REQUIRED"
  | "NO_SETTLEMENT"
  | "INVALID_DATA";

export interface GSTSettings {
  gstRegistered: boolean;
  purchaseGSTRate: number;
  sellingGSTRate: number;
  itcEligible: boolean;
}

export interface RTOSettings {
  rtoShippingCost: number;
  chargeProductCostOnRTO: boolean;
}

export interface ReturnSettings {
  returnProductCondition: ReturnProductCondition;
}

export interface UserSettings {
  currency: string;
  adAllocationMethod: AdAllocationMethod;
  defaultProfitView: ProfitView;
  decimalPlaces: number;
  rto: RTOSettings;
  returnOrder: ReturnSettings;
}

export interface SKUCost {
  supplierSKU: string;
  productName?: string;
  purchaseCostInclGST: number | null;
  gstRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeeshoFees {
  meeshoCommission?: number | null;
  fixedFee?: number | null;
  warehousingFee?: number | null;
  returnShippingCharge?: number | null;
  shippingCharge?: number | null;
  otherSupportServiceCharges?: number | null;
  waivers?: number | null;
  tcs?: number | null;
  tds?: number | null;
  compensation?: number | null;
  claims?: number | null;
  recovery?: number | null;
}

export interface Order {
  id: string;
  subOrderNo: string;
  orderDate: Date | null;
  dispatchDate?: Date | null;
  productName: string;
  supplierSKU: string;
  catalogID?: string;
  orderSource?: string;
  liveOrderStatus: OrderStatus;
  rawStatus: string;
  listingPrice?: number | null;
  quantity: number;
  totalSaleAmount?: number | null;
  totalSaleReturnAmount?: number | null;
  finalSettlementAmount: number | null;
  productGSTPercent?: number | null;
  actualGSTAmount?: number | null;
  meeshoFees: MeeshoFees;
  rawFields: Record<string, any>;
  importedAt: string;
}

export interface OrderProfitResult {
  settlement: number | null;
  quantity: number;
  purchaseCostInclGST: number | null;
  purchaseCostExclGST: number | null;
  inputGST: number | null;
  outputGST: number | null;
  outputGSTEstimated: boolean;
  cashProfitBeforeAds: number | null;
  allocatedAdCost: number | null;
  netCashProfit: number | null;
  gstAdjustedProfit: number | null;
  netGSTPayable: number | null;
  margin: number | null;
  status: OrderStatus;
  calculationStatus: CalculationStatus;
  warnings: string[];
  returnBreakdown?: {
    effectiveCondition: PerOrderReturnCondition;
    isManualOverride: boolean;
    returnShippingCharge: number;
    purchaseCostLoss: number;
    totalReturnLoss: number;
  };
}

export interface OrderWithCalculations extends Order {
  purchaseCostPerUnit: number | null;
  actualPurchaseAmountPaid: number | null;
  taxableCostPerUnit: number | null;
  inputGSTPerUnit: number | null;
  totalInputGST: number | null;
  taxableCOGS: number | null;
  basicCashProfit: number | null;
  estimatedAccountingProfit: number | null;
  estimatedAdAllocation: number | null;
  netProfit: number | null;
  profitPercent: number | null;
  marginPercent: number | null;
  hasMissingCost: boolean;
  rowStatus: CalculationStatus;
  warnings: string[];
  outputGST: number | null;
  outputGSTEstimated: boolean;
  netGSTPayable: number | null;
  gstAdjustedProfit: number | null;
  cashProfitBeforeAds: number | null;
  returnBreakdown?: {
    effectiveCondition: PerOrderReturnCondition;
    isManualOverride: boolean;
    returnShippingCharge: number;
    purchaseCostLoss: number;
    totalReturnLoss: number;
  };
}

export interface AdsCostEntry {
  id: string;
  deductionDuration?: string;
  deductionDate: Date | null;
  campaignID?: string;
  adCost: number | null;
  credits?: number | null;
  waivers?: number | null;
  discounts?: number | null;
  adCostNet?: number | null;
  gst?: number | null;
  totalAdsCost: number | null;
  rawFields: Record<string, any>;
  importedAt: string;
}

export interface ReferralPayment {
  id: string;
  date: Date | null;
  reason?: string;
  amount: number | null;
  subOrderNo?: string;
  rawFields: Record<string, any>;
  importedAt: string;
}

export interface CompensationEntry {
  id: string;
  date: Date | null;
  program?: string;
  reason?: string;
  compensationAmount: number | null;
  recoveryAmount: number | null;
  subOrderNo?: string;
  rawFields: Record<string, any>;
  importedAt: string;
}

export interface ImportSummary {
  fileName: string;
  sheetsFound: string[];
  ordersFound: number;
  validOrders: number;
  duplicateOrders: number;
  missingSKU: number;
  missingSettlement: number;
  uniqueSKUs: number;
  totalQuantity: number;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  adsEntriesFound: number;
  referralPaymentsFound: number;
  compensationEntriesFound: number;
  warnings: string[];
  errors: string[];
}

export interface ParsedWorkbook {
  orders: Order[];
  ads: AdsCostEntry[];
  referrals: ReferralPayment[];
  compensations: CompensationEntry[];
  summary: ImportSummary;
}

export interface SKUAggregate {
  supplierSKU: string;
  productName: string;
  units: number;
  unitsSold: number;
  sales: number;
  settlement: number;
  purchaseCost: number | null;
  cogs: number | null;
  inputGST: number | null;
  adCost: number | null;
  profit: number | null;
  profitPerUnit: number | null;
  margin: number | null;
  roi: number | null;
  rtoCount: number;
  returnCount: number;
  cancellationCount: number;
  hasMissingCost: boolean;
}

export interface MonthlyAggregate {
  monthKey: string;
  monthLabel: string;
  orders: number;
  units: number;
  sales: number;
  settlement: number;
  purchaseCost: number | null;
  cogs: number | null;
  adSpend: number;
  profit: number | null;
  margin: number | null;
  returns: number;
  rto: number;
  cancellations: number;
}

export interface AppData {
  orders: Order[];
  ads: AdsCostEntry[];
  referrals: ReferralPayment[];
  compensations: CompensationEntry[];
  skuCosts: SKUCost[];
  gstSettings: GSTSettings;
  userSettings: UserSettings;
}
