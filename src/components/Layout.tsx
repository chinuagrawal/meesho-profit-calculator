import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Download, Upload } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useApp } from "@/context/AppContext";
import * as XLSX from "xlsx";
import { aggregateBySKU } from "@/calculations";
import {
  formatDate,
  formatINR,
  formatPercent,
  formatNumber,
} from "@/lib/utils";
import { OrderWithCalculations, SKUAggregate } from "@/types";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const { enrichedOrders, skuCosts } = useApp();

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined || val === "—") return "";
    const s = String(val);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const downloadXLSX = (
    rows: Record<string, any>[],
    filename: string,
    sheetName: string,
  ) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  };

  const downloadCSV = (rows: Record<string, any>[], filename: string) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }
    const headers = Object.keys(rows[0]);
    const headerLine = headers.map(escapeCSV).join(",");
    const bodyLines = rows.map((row) =>
      headers.map((h) => escapeCSV(row[h])).join(","),
    );
    const csv = [headerLine, ...bodyLines].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFile = (
    rows: Record<string, any>[],
    baseName: string,
    sheetName: string,
  ) => {
    if (exportFormat === "xlsx") {
      downloadXLSX(rows, `${baseName}.xlsx`, sheetName);
    } else {
      downloadCSV(rows, `${baseName}.csv`);
    }
  };

  const exportOrders = () => {
    const rows = enrichedOrders.map((o) => ({
      "Order Date": formatDate(o.orderDate),
      "Sub Order No": o.subOrderNo,
      Product: o.productName,
      SKU: o.supplierSKU,
      Quantity: o.quantity,
      "Order Status": o.rawStatus || o.liveOrderStatus,
      "Listing Price": o.listingPrice,
      "Total Sale Amount": o.totalSaleAmount,
      "Final Settlement": o.finalSettlementAmount,
      "Purchase Cost / Unit": o.purchaseCostPerUnit,
      "Actual COGS": o.actualPurchaseAmountPaid,
      "Input GST": o.totalInputGST,
      "Basic Cash Profit": o.basicCashProfit,
      "Estimated Accounting Profit": o.estimatedAccountingProfit,
      "Ad Cost (Estimated)": o.estimatedAdAllocation,
      "Net Profit": o.netProfit,
      "Profit %":
        o.profitPercent !== null ? `${formatNumber(o.profitPercent, 2)}%` : "—",
      "Margin %":
        o.marginPercent !== null ? `${formatNumber(o.marginPercent, 2)}%` : "—",
      Status: o.rowStatus,
    }));
    exportFile(rows, "Meesho-Profit-Orders", "Orders");
  };

  const exportSKUAnalysis = () => {
    const skuAggs = aggregateBySKU(enrichedOrders);
    const rows = skuAggs.map((s: SKUAggregate) => ({
      SKU: s.supplierSKU,
      Product: s.productName,
      Units: s.units,
      Sales: s.sales,
      Settlement: s.settlement,
      "Purchase Cost": s.purchaseCost,
      COGS: s.cogs,
      "Input GST": s.inputGST,
      "Ad Cost": s.adCost,
      Profit: s.profit,
      "Margin %": s.margin !== null ? `${formatNumber(s.margin, 2)}%` : "—",
      "ROI %": s.roi !== null ? `${formatNumber(s.roi, 2)}%` : "—",
      "Has Missing Cost": s.hasMissingCost ? "Yes" : "No",
    }));
    exportFile(rows, "Meesho-SKU-Analysis", "SKU Analysis");
  };

  const exportProfitReport = () => {
    const rows = enrichedOrders.map((o: OrderWithCalculations) => ({
      "Order Date": formatDate(o.orderDate),
      "Sub Order No": o.subOrderNo,
      Product: o.productName,
      SKU: o.supplierSKU,
      Quantity: o.quantity,
      Settlement: o.finalSettlementAmount,
      "Purchase Cost Incl. GST": o.actualPurchaseAmountPaid,
      "Input GST": o.totalInputGST,
      COGS: o.taxableCOGS ?? o.actualPurchaseAmountPaid,
      "Basic Profit": o.basicCashProfit,
      "Ad Cost": o.estimatedAdAllocation,
      "Net Profit": o.netProfit,
      "Margin %":
        o.marginPercent !== null ? `${formatNumber(o.marginPercent, 2)}%` : "—",
      Status: o.rowStatus,
    }));
    exportFile(rows, "Meesho-Profit-Report", "Profit Report");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-800">
              Meesho Profit Calculator
            </h1>
            <p className="text-xs text-slate-500">
              {enrichedOrders.length} orders · {skuCosts.length} SKUs ·{" "}
              {skuCosts.filter((s) => s.purchaseCostInclGST === null).length}{" "}
              missing costs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1">
              <div className="flex items-center mr-1 rounded-md border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExportFormat("xlsx")}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    exportFormat === "xlsx"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Export as Excel (.xlsx)"
                >
                  XLSX
                </button>
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    exportFormat === "csv"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Export as Comma-Separated (.csv)"
                >
                  CSV
                </button>
              </div>
              <button
                onClick={exportOrders}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
                title={`Export Orders (${exportFormat.toUpperCase()})`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline">Orders</span>
              </button>
              <button
                onClick={exportSKUAnalysis}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
                title={`Export SKU Analysis (${exportFormat.toUpperCase()})`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline">SKU</span>
              </button>
              <button
                onClick={exportProfitReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                title={`Export Profit Report (${exportFormat.toUpperCase()})`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline">Profit Report</span>
              </button>
            </div>
            <button
              onClick={() => (window.location.href = "/import")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import Data</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
