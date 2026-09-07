import { useMemo } from "react";
import { Receipt, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Select,
  Checkbox,
  Input,
  Alert,
  Badge,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { calculatePurchaseGSTComponents } from "@/calculations";
import { formatINR, formatNumber, formatPercent } from "@/lib/utils";

const GST_OPTIONS = [0, 5, 12, 18, 28];

export default function GSTPage() {
  const { gstSettings, setGSTSettings, enrichedOrders, skuCosts } = useApp();

  const summary = useMemo(() => {
    let purchaseInclGST = 0;
    let inputGST = 0;
    let outputGST = 0;
    let outputGSTEstimated = 0;
    let outputGSTActual = 0;
    let hasActualOutputGST = false;

    for (const o of enrichedOrders) {
      if (o.totalInputGST !== null && o.totalInputGST !== undefined) {
        inputGST += o.totalInputGST;
      }
      if (
        o.actualPurchaseAmountPaid !== null &&
        o.actualPurchaseAmountPaid !== undefined
      ) {
        purchaseInclGST += o.actualPurchaseAmountPaid;
      }
      if (o.outputGST !== null && o.outputGST !== undefined) {
        outputGST += o.outputGST;
        if (o.outputGSTEstimated) {
          outputGSTEstimated += o.outputGST;
        } else {
          outputGSTActual += o.outputGST;
          hasActualOutputGST = true;
        }
      }
    }

    const eligibleInputGST = gstSettings.itcEligible ? inputGST : 0;
    const estimatedPayable = outputGST - eligibleInputGST;

    return {
      purchaseInclGST,
      inputGST,
      outputGST,
      outputGSTActual,
      outputGSTEstimated,
      hasActualOutputGST,
      eligibleInputGST,
      estimatedPayable,
    };
  }, [enrichedOrders, gstSettings]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-indigo-600" />
          GST Settings & Summary
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Purchase cost is always entered <strong>INCLUDING GST</strong>. The
          application automatically splits it into Taxable Cost + Input GST.
        </p>
      </div>

      <Alert variant="warning" className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="text-sm space-y-1">
          <div>
            <strong>Disclaimer:</strong> GST calculations / accounting view
            shown here are estimates based on the information available in the
            uploaded report and your GST settings. They are for reference only.
          </div>
          <div>
            Actual GST liability depends on your registration status, eligible
            Input Tax Credit, returns, adjustments, and other transactions.
          </div>
          <div>
            <strong>This is not tax / legal advice.</strong> Please verify all
            numbers with a CA / chartered accountant or qualified tax
            professional before filing.
          </div>
        </div>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>GST Settings</CardTitle>
            <CardDescription>
              Configure defaults used when parsing new SKUs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <Checkbox
                checked={gstSettings.gstRegistered}
                onChange={(e) =>
                  setGSTSettings({
                    ...gstSettings,
                    gstRegistered: e.target.checked,
                  })
                }
              />
              <div>
                <div className="font-semibold text-sm text-slate-900">
                  GST Registered?
                </div>
                <div className="text-xs text-slate-500">
                  If No: entire purchase cost is treated as business expense (no
                  ITC), selling side GST is not estimated.
                </div>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  Default Purchase GST Rate
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={
                      GST_OPTIONS.includes(gstSettings.purchaseGSTRate)
                        ? String(gstSettings.purchaseGSTRate)
                        : "custom"
                    }
                    onChange={(e) =>
                      setGSTSettings({
                        ...gstSettings,
                        purchaseGSTRate:
                          e.target.value === "custom"
                            ? gstSettings.purchaseGSTRate
                            : Number(e.target.value),
                      })
                    }
                  >
                    {GST_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}%
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </Select>
                  {!GST_OPTIONS.includes(gstSettings.purchaseGSTRate) && (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-24"
                      value={gstSettings.purchaseGSTRate}
                      onChange={(e) =>
                        setGSTSettings({
                          ...gstSettings,
                          purchaseGSTRate: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Default Selling GST Rate</Label>
                <div className="flex gap-2">
                  <Select
                    value={
                      GST_OPTIONS.includes(gstSettings.sellingGSTRate)
                        ? String(gstSettings.sellingGSTRate)
                        : "custom"
                    }
                    onChange={(e) =>
                      setGSTSettings({
                        ...gstSettings,
                        sellingGSTRate:
                          e.target.value === "custom"
                            ? gstSettings.sellingGSTRate
                            : Number(e.target.value),
                      })
                    }
                  >
                    {GST_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}%
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </Select>
                  {!GST_OPTIONS.includes(gstSettings.sellingGSTRate) && (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-24"
                      value={gstSettings.sellingGSTRate}
                      onChange={(e) =>
                        setGSTSettings({
                          ...gstSettings,
                          sellingGSTRate: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </div>
              </div>
            </div>

            <label
              className={
                "flex items-center gap-3 p-3 rounded-lg border " +
                (gstSettings.itcEligible
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-slate-50 border-slate-200")
              }
            >
              <Checkbox
                checked={gstSettings.itcEligible}
                onChange={(e) =>
                  setGSTSettings({
                    ...gstSettings,
                    itcEligible: e.target.checked,
                  })
                }
              />
              <div>
                <div className="font-semibold text-sm text-slate-900">
                  Input Tax Credit (ITC) Eligible?
                </div>
                <div className="text-xs text-slate-500">
                  If Yes: recoverable input GST is excluded from Accounting COGS
                  & ITC is shown on the summary.
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimated GST Summary</CardTitle>
            <CardDescription>
              Based on your uploaded orders &amp; settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row
              label="Purchase Amount (Incl. GST)"
              value={formatINR(summary.purchaseInclGST)}
              muted
            />
            <Row
              label="Input GST (Purchase side)"
              value={formatINR(summary.inputGST)}
              rightBadge={<Badge variant="info">Purchase</Badge>}
            />
            <Row
              label={
                <div>
                  Output GST
                  <span className="text-[10px] text-slate-500 font-normal block">
                    {summary.hasActualOutputGST
                      ? "Contains actuals from report"
                      : gstSettings.gstRegistered
                        ? `Estimated @ ${gstSettings.sellingGSTRate}% (registered seller)`
                        : "Not estimated (set as not GST registered)"}
                  </span>
                </div>
              }
              value={formatINR(summary.outputGST)}
              rightBadge={
                <Badge
                  variant={summary.hasActualOutputGST ? "success" : "warning"}
                >
                  {summary.hasActualOutputGST
                    ? summary.outputGSTEstimated > 0
                      ? "Mixed"
                      : "Actual"
                    : "Estimated"}
                </Badge>
              }
            />
            <Row
              label="ITC Available (Eligible Input GST)"
              value={
                gstSettings.itcEligible
                  ? formatINR(summary.eligibleInputGST)
                  : "— (Not eligible)"
              }
            />
            <div className="pt-3 mt-3 border-t">
              <Row
                label={
                  <span>
                    Estimated GST Payable
                    <span className="text-[10px] text-slate-500 font-normal block">
                      Before other credits / adjustments
                    </span>
                  </span>
                }
                value={formatINR(summary.estimatedPayable)}
                highlight={summary.estimatedPayable < 0 ? "good" : "warn"}
                valueSize="lg"
              />
              {summary.estimatedPayable < 0 && (
                <div className="text-xs text-emerald-700 mt-1 bg-emerald-50 rounded p-2 border border-emerald-100">
                  ITC exceeds output GST — estimated carry-forward / refund of{" "}
                  <strong>
                    {formatINR(Math.abs(summary.estimatedPayable))}
                  </strong>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How GST is Split</CardTitle>
          <CardDescription>
            Example: Purchase cost ₹118 incl. GST @{" "}
            {gstSettings.purchaseGSTRate}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GSTExample rate={gstSettings.purchaseGSTRate} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  rightBadge,
  highlight,
  valueSize,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  rightBadge?: React.ReactNode;
  highlight?: "good" | "warn" | "bad";
  valueSize?: "lg";
  muted?: boolean;
}) {
  const highlightCls =
    highlight === "good"
      ? "text-emerald-700"
      : highlight === "warn"
        ? "text-amber-700"
        : highlight === "bad"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <div
      className={
        "flex items-center justify-between py-1.5 " +
        (muted ? "text-slate-600" : "text-slate-800")
      }
    >
      <div className="text-sm flex items-center gap-2">{label}</div>
      <div className="flex items-center gap-2">
        {rightBadge}
        <div
          className={
            "tabular-nums font-semibold " +
            highlightCls +
            " " +
            (valueSize === "lg" ? "text-xl" : "text-sm")
          }
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function GSTExample({ rate }: { rate: number }) {
  const inclusive = 118;
  const per = calculatePurchaseGSTComponents(inclusive, rate);
  return (
    <div className="grid md:grid-cols-4 gap-4 text-sm">
      <Example label="Purchase Cost (Incl. GST)" value={formatINR(inclusive)} />
      <Example
        label={`Taxable Purchase Cost`}
        sub={`÷ ${formatNumber(1 + rate / 100, 4)}`}
        value={formatINR(per.taxableCost)}
      />
      <Example
        label="Input GST"
        sub={`${inclusive} − ${formatNumber(per.taxableCost ?? 0, 2)}`}
        value={formatINR(per.inputGST)}
        tone="good"
      />
      <Example
        label="GST Rate Applied"
        value={formatPercent(rate, 0)}
        tone="info"
      />
    </div>
  );
}

function Example({
  label,
  sub,
  value,
  tone,
}: {
  label: string;
  sub?: string;
  value: string;
  tone?: "good" | "info" | "warn";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "info"
        ? "border-blue-200 bg-blue-50"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-slate-50";
  return (
    <div className={`p-4 rounded-lg border ${toneCls}`}>
      <div className="text-xs text-slate-600 font-medium">{label}</div>
      {sub && (
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sub}</div>
      )}
      <div className="mt-2 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
