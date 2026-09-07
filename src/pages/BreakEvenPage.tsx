import { useMemo, useState } from "react";
import { Calculator, Tag, IndianRupee, TrendingUp, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Alert,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { aggregateBySKU } from "@/calculations";
import { formatINR, formatNumber, formatPercent } from "@/lib/utils";
import { calculatePurchaseGSTComponents } from "@/calculations";
import { SKUAggregate } from "@/types";

export default function BreakEvenPage() {
  const { enrichedOrders, gstSettings, ads } = useApp();
  const skuAggs: SKUAggregate[] = useMemo(
    () => aggregateBySKU(enrichedOrders),
    [enrichedOrders]
  );

  const [selectedSKU, setSelectedSKU] = useState<string>(
    skuAggs[0]?.supplierSKU ?? ""
  );
  const [desiredProfitPerUnit, setDesiredProfitPerUnit] = useState<string>("");

  const current = skuAggs.find((s) => s.supplierSKU === selectedSKU);

  // Estimate avg settlement per unit for this SKU
  const currentStats = useMemo(() => {
    if (!current) return null;
    const units = current.units || 1;
    const settlementPerUnit = current.settlement / units;
    const purchasePerUnit =
      current.purchaseCost !== null && current.units > 0
        ? current.purchaseCost / current.units
        : null;
    const profitPerUnit =
      current.profit !== null && current.units > 0
        ? current.profit / current.units
        : null;
    const adPerUnit =
      current.adCost && current.units > 0 ? current.adCost / current.units : 0;
    const perRate =
      purchasePerUnit !== null
        ? current.hasMissingCost
          ? gstSettings.purchaseGSTRate
          : null
        : null;
    const rate =
      perRate ??
      (current.hasMissingCost ? gstSettings.purchaseGSTRate : null) ??
      gstSettings.purchaseGSTRate;
    return {
      units: current.units,
      settlementPerUnit,
      purchasePerUnit,
      profitPerUnit,
      adPerUnit,
      marginPerUnit: settlementPerUnit > 0 ? (profitPerUnit ?? 0) / settlementPerUnit * 100 : null,
      gstRate: rate,
      roiPerUnit: purchasePerUnit && purchasePerUnit > 0 && profitPerUnit !== null
        ? (profitPerUnit / purchasePerUnit) * 100
        : null,
    };
  }, [current, gstSettings]);

  const desiredNum = useMemo(() => {
    const n = parseFloat(desiredProfitPerUnit);
    return isNaN(n) ? null : n;
  }, [desiredProfitPerUnit]);

  const requiredCalc = useMemo(() => {
    if (!currentStats || !desiredNum) return null;
    const rate = currentStats.gstRate;
    const purchase =
      currentStats.purchasePerUnit; // incl GST
    const ad = currentStats.adPerUnit;
    if (purchase === null) return null;

    const components = calculatePurchaseGSTComponents(purchase, rate);
    const taxable = components.taxableCost ?? purchase;
    const inputGST = components.inputGST ?? 0;

    // Required settlement = purchase (incl GST) + desired profit + ad
    const requiredSettlementPerUnit = purchase + desiredNum + ad;
    const grossSettlement = requiredSettlementPerUnit * currentStats.units;

    // Historical fee ratio: (Sale - Settlement) / Sale per unit
    const avgSalePerUnit = (current?.sales ?? 0) / Math.max(currentStats.units, 1);
    const feeRatio =
      avgSalePerUnit > 0
        ? Math.max(
            0,
            (avgSalePerUnit - currentStats.settlementPerUnit) / avgSalePerUnit
          )
        : 0.15;
    const estimatedSellingPrice =
      feeRatio >= 1
        ? requiredSettlementPerUnit
        : requiredSettlementPerUnit / (1 - feeRatio);

    return {
      requiredSettlementPerUnit,
      grossSettlement,
      feeRatio,
      estimatedSellingPrice,
    };
  }, [currentStats, desiredNum, current]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-600" />
          Break-Even Calculator
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Set a desired profit per unit to estimate the required settlement and
          listing selling price for each SKU, based on your historical Meesho
          fee ratio.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Calculate</CardTitle>
            <CardDescription>
              Pick a SKU and enter how much profit you want per unit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Select SKU</Label>
              <Select
                value={selectedSKU}
                onChange={(e) => setSelectedSKU(e.target.value)}
                className="mt-1.5"
              >
                <option value="">— Choose a SKU —</option>
                {skuAggs.map((s) => (
                  <option key={s.supplierSKU} value={s.supplierSKU}>
                    {s.supplierSKU} — {s.productName.slice(0, 50)} (
                    {s.units} units)
                  </option>
                ))}
              </Select>
              {skuAggs.length === 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  No SKUs. Import a report first.
                </p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block">Desired Profit per Unit (₹)</Label>
              <div className="flex items-stretch gap-2">
                <div className="flex items-center px-3 rounded-md bg-slate-100 border border-slate-200">
                  <IndianRupee className="w-4 h-4 text-slate-600" />
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 100"
                  className="flex-1"
                  value={desiredProfitPerUnit}
                  onChange={(e) => setDesiredProfitPerUnit(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    className="px-2.5 py-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
                    onClick={() => setDesiredProfitPerUnit(String(v))}
                  >
                    ₹{v}
                  </button>
                ))}
              </div>
            </div>

            {!current?.hasMissingCost === false && (
              <Alert variant="warning" className="text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  This SKU is missing a purchase cost. Calculations below
                  assume GST rate {gstSettings.purchaseGSTRate}% — visit SKU
                  Costs page to set an exact cost.
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current SKU Performance</CardTitle>
            <CardDescription>
              {current?.supplierSKU || "Select a SKU to see details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStats ? (
              <div className="space-y-3 text-sm">
                <Row
                  label="Product"
                  value={
                    <span className="font-medium truncate max-w-[260px] inline-block">
                      {current?.productName}
                    </span>
                  }
                />
                <Row label="Units Sold" value={currentStats.units.toLocaleString("en-IN")} />
                <Row
                  label="Purchase / Unit (Incl GST)"
                  value={
                    currentStats.purchasePerUnit !== null
                      ? formatINR(currentStats.purchasePerUnit)
                      : "—"
                  }
                  highlight={currentStats.purchasePerUnit === null ? "warn" : undefined}
                />
                <Row
                  label="GST Rate (Used)"
                  value={formatPercent(currentStats.gstRate, 0)}
                />
                <Row
                  label="Avg Meesho Settlement / Unit"
                  value={formatINR(currentStats.settlementPerUnit)}
                  highlight="info"
                />
                <Row
                  label="Avg Ad Allocation / Unit"
                  value={currentStats.adPerUnit ? formatINR(currentStats.adPerUnit) : "—"}
                />
                <div className="pt-2 border-t border-slate-100">
                  <Row
                    label="Current Profit / Unit"
                    value={
                      currentStats.profitPerUnit !== null
                        ? formatINR(currentStats.profitPerUnit)
                        : "—"
                    }
                    highlight={
                      currentStats.profitPerUnit === null
                        ? "warn"
                        : currentStats.profitPerUnit >= 0
                        ? "good"
                        : "bad"
                    }
                    valueSize="lg"
                  />
                  <div className="flex gap-4 mt-2">
                    <div className="flex-1">
                      <div className="text-xs text-slate-500">Margin</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {currentStats.marginPerUnit !== null
                          ? formatPercent(currentStats.marginPerUnit, 1)
                          : "—"}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-500">ROI</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {currentStats.roiPerUnit !== null
                          ? formatPercent(currentStats.roiPerUnit, 1)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-500">
                <Calculator className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No SKU selected
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Required to Hit Your Desired Profit
            {requiredCalc ? (
              <span className="ml-auto text-xs text-slate-500 font-normal">
                *Estimated using historical fee ratio (
                {formatNumber(requiredCalc.feeRatio * 100, 1)}%)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requiredCalc ? (
            <div className="grid md:grid-cols-3 gap-4">
              <ResultCard
                label="Desired Profit / Unit"
                value={formatINR(desiredNum)}
                tone="good"
              />
              <ResultCard
                label="Required Meesho Settlement / Unit"
                value={formatINR(requiredCalc.requiredSettlementPerUnit)}
                tone="info"
                sub="= Purchase + Desired Profit + Ad"
              />
              <ResultCard
                label="Estimated Selling Price / Unit *"
                value={formatINR(requiredCalc.estimatedSellingPrice)}
                tone="warn"
                sub="Based on historical fee ratio"
              />
              <div className="md:col-span-3 mt-1 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div>
                  <strong>Across {currentStats?.units} units:</strong>
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    Required total Meesho settlement:{" "}
                    <strong className="text-slate-900">
                      {formatINR(requiredCalc.grossSettlement)}
                    </strong>
                  </li>
                  <li>
                    Estimated total listing sales value:{" "}
                    <strong className="text-slate-900">
                      {formatINR(
                        requiredCalc.estimatedSellingPrice *
                          (currentStats?.units ?? 0)
                      )}
                    </strong>
                  </li>
                </ul>
                <div className="pt-2 italic text-slate-500">
                  * Meesho fees vary by category, price, shipping, etc. These
                  are estimates based on your uploaded history.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Select a SKU and enter a desired profit to see estimates.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  valueSize,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "good" | "bad" | "warn" | "info";
  valueSize?: "lg";
}) {
  const cls =
    highlight === "good"
      ? "text-emerald-700"
      : highlight === "bad"
      ? "text-red-700"
      : highlight === "warn"
      ? "text-amber-700"
      : highlight === "info"
      ? "text-blue-700"
      : "text-slate-900";
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums font-semibold ${cls} ${valueSize === "lg" ? "text-lg" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "good" | "warn" | "info";
}) {
  const toneCls =
    tone === "good"
      ? "from-emerald-500 to-teal-600 border-emerald-200 bg-emerald-50"
      : tone === "warn"
      ? "from-amber-500 to-orange-600 border-amber-200 bg-amber-50"
      : "from-blue-500 to-indigo-600 border-blue-200 bg-blue-50";
  return (
    <div className={`rounded-xl p-5 border ${toneCls}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}
