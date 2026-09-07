import { useMemo, useState, useRef } from "react";
import {
  Settings,
  IndianRupee,
  Percent,
  Megaphone,
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Save,
  Calculator,
  RotateCcw,
} from "lucide-react";
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
import {
  AdAllocationMethod,
  ProfitView,
  GSTSettings,
  UserSettings,
} from "@/types";

const GST_RATES = [0, 5, 12, 18, 28];

export default function SettingsPage() {
  const {
    gstSettings,
    setGSTSettings,
    userSettings,
    setUserSettings,
    orders,
    skuCosts,
    ads,
    referrals,
    compensations,
    backupData,
    restoreData,
    clearAllData,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreJSON, setRestoreJSON] = useState("");
  const [clearConfirm, setClearConfirm] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "danger" | "info";
    text: string;
  } | null>(null);

  const stats = useMemo(
    () => ({
      orders: orders.length,
      skuCosts: skuCosts.length,
      ads: ads.length,
      referrals: referrals.length,
      compensations: compensations.length,
      missing: skuCosts.filter(
        (s) =>
          s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
      ).length,
    }),
    [orders, skuCosts, ads, referrals, compensations],
  );

  const updateGST = (patch: Partial<GSTSettings>) => {
    setGSTSettings({ ...gstSettings, ...patch });
  };
  const updateUser = (patch: Partial<UserSettings>) => {
    setUserSettings({ ...userSettings, ...patch });
  };

  const showMsg = (type: "success" | "danger" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const doBackup = async () => {
    try {
      const json = await backupData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `meesho-profit-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg("success", "Backup downloaded successfully.");
    } catch (e: any) {
      showMsg("danger", "Backup failed: " + (e?.message ?? e));
    }
  };

  const handleRestoreFile = async (f: File) => {
    try {
      const text = await f.text();
      JSON.parse(text);
      await restoreData(text);
      showMsg("success", "Data restored successfully.");
    } catch (e: any) {
      showMsg("danger", "Restore failed: " + (e?.message ?? "Invalid file"));
    }
  };

  const doRestorePaste = async () => {
    try {
      JSON.parse(restoreJSON);
      await restoreData(restoreJSON);
      setRestoreJSON("");
      showMsg("success", "Data restored from JSON.");
    } catch (e: any) {
      showMsg("danger", "Invalid JSON: " + (e?.message ?? e));
    }
  };

  const doClear = async () => {
    if (clearConfirm.trim().toLowerCase() !== "delete all") {
      showMsg(
        "danger",
        'Type "DELETE ALL" exactly to confirm clearing all data.',
      );
      return;
    }
    await clearAllData();
    setClearConfirm("");
    showMsg("success", "All data cleared.");
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          Settings
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Configure calculation behaviour, defaults and data management.
        </p>
      </div>

      {message && (
        <Alert
          variant={
            message.type === "success"
              ? "success"
              : message.type === "danger"
                ? "danger"
                : "info"
          }
          className="flex items-start gap-2"
        >
          {message.text}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5" /> General
          </CardTitle>
          <CardDescription>Currency and display defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Currency</Label>
              <Select className="mt-1.5" disabled value="INR">
                <option value="INR">Indian Rupee (₹ INR)</option>
              </Select>
            </div>
            <div>
              <Label>Default Profit View</Label>
              <Select
                className="mt-1.5"
                value={userSettings.defaultProfitView}
                onChange={(e) =>
                  updateUser({
                    defaultProfitView: e.target.value as ProfitView,
                  })
                }
              >
                <option value="cash">
                  Cash Profit (Settlement − Purchase)
                </option>
                <option value="accounting">
                  Accounting / Estimated Profit
                </option>
                <option value="net">Net Profit (after ads)</option>
              </Select>
            </div>
            <div>
              <Label>Decimal Places</Label>
              <Input
                type="number"
                min={0}
                max={4}
                className="mt-1.5"
                value={userSettings.decimalPlaces}
                onChange={(e) =>
                  updateUser({
                    decimalPlaces: Math.max(
                      0,
                      Math.min(4, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" /> GST
          </CardTitle>
          <CardDescription>
            Applies to SKUs that don't have a product-level GST in the report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            label="GST Registered?"
            desc="Registered sellers can claim Input Tax Credit on purchases."
            checked={gstSettings.gstRegistered}
            onChange={(v) => updateGST({ gstRegistered: v })}
          />
          <div className="grid md:grid-cols-2 gap-4">
            <RatePicker
              label="Default Purchase GST Rate"
              value={gstSettings.purchaseGSTRate}
              onChange={(v) => updateGST({ purchaseGSTRate: v })}
            />
            <RatePicker
              label="Default Selling GST Rate"
              value={gstSettings.sellingGSTRate}
              onChange={(v) => updateGST({ sellingGSTRate: v })}
            />
          </div>
          <ToggleRow
            label="Input Tax Credit (ITC) Eligible?"
            desc="If eligible, recoverable GST is excluded from Accounting COGS."
            checked={gstSettings.itcEligible}
            onChange={(v) => updateGST({ itcEligible: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Advertising
          </CardTitle>
          <CardDescription>
            How ad costs should be allocated across orders for Net Profit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              {
                value: "none",
                label: "Do not include Ads",
                desc: "Net Profit equals Basic Profit. Ad spend shown separately.",
              },
              {
                value: "equal",
                label: "Equal allocation across orders",
                desc: "Divide total ad cost equally over all non-cancelled orders.",
              },
              {
                value: "byOrderValue",
                label: "Allocate by order value",
                desc: "Spread based on each order's Final Settlement Amount.",
              },
              {
                value: "byQuantity",
                label: "Allocate by quantity",
                desc: "Spread based on number of units per order.",
              },
            ] as { value: AdAllocationMethod; label: string; desc: string }[]
          ).map((opt) => (
            <label
              key={opt.value}
              className={
                "p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors " +
                (userSettings.adAllocationMethod === opt.value
                  ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                  : "border-slate-200 hover:bg-slate-50")
              }
            >
              <input
                type="radio"
                checked={userSettings.adAllocationMethod === opt.value}
                onChange={() => updateUser({ adAllocationMethod: opt.value })}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> RTO (Return to Origin)
          </CardTitle>
          <CardDescription>
            Configure how RTO orders affect cost calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>RTO Shipping Cost</Label>
              <div className="mt-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={userSettings.rto?.rtoShippingCost ?? 0}
                    disabled
                    className="flex-1 bg-slate-50"
                  />
                  <Badge variant="muted" className="whitespace-nowrap">
                    Fixed ₹0
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Your business does not incur RTO return shipping charges.
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <ToggleRow
                label="Charge Product Cost on RTO"
                desc="If ON, RTO Profit = Settlement − Purchase Cost. If OFF, RTO Profit = Settlement (₹0 since inventory returns; no loss of goods)."
                checked={userSettings.rto?.chargeProductCostOnRTO ?? true}
                onChange={(v) =>
                  updateUser({
                    rto: {
                      rtoShippingCost: userSettings.rto?.rtoShippingCost ?? 0,
                      chargeProductCostOnRTO: v,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" /> Data
          </CardTitle>
          <CardDescription>
            Backup & restore. All data is stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <StatCard label="Orders" value={stats.orders} />
            <StatCard
              label="SKU Costs"
              value={stats.skuCosts}
              sub={`${stats.missing} missing`}
            />
            <StatCard label="Ads Entries" value={stats.ads} />
            <StatCard label="Referrals" value={stats.referrals} />
            <StatCard label="Compensation" value={stats.compensations} />
            <StatCard
              label="Total Records"
              value={
                stats.orders +
                stats.skuCosts +
                stats.ads +
                stats.referrals +
                stats.compensations
              }
              tone="info"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <Button onClick={doBackup} variant="primary">
              <Download className="w-4 h-4" /> Backup as JSON
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> Restore from file
              </Button>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleRestoreFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <details className="rounded-lg border border-slate-200">
            <summary className="cursor-pointer p-3 text-sm font-medium hover:bg-slate-50">
              Restore from JSON text (paste)
            </summary>
            <div className="p-3 pt-0 space-y-2 border-t">
              <textarea
                rows={6}
                className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono"
                placeholder='{ "orders": [], ... }'
                value={restoreJSON}
                onChange={(e) => setRestoreJSON(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={doRestorePaste}>
                <RefreshCw className="w-4 h-4" /> Restore Pasted JSON
              </Button>
            </div>
          </details>

          <details className="rounded-lg border border-red-200 bg-red-50/30">
            <summary className="cursor-pointer p-3 text-sm font-medium text-red-700 hover:bg-red-50 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Clear all application data
            </summary>
            <div className="p-3 pt-0 space-y-2 border-t border-red-100">
              <Alert variant="danger" className="text-xs">
                This deletes orders, SKU costs, ads, referrals, compensation
                entries and settings from this browser. Export a backup first!
              </Alert>
              <Label>
                Type <code className="font-mono">DELETE ALL</code> to confirm:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={clearConfirm}
                  onChange={(e) => setClearConfirm(e.target.value)}
                  placeholder="DELETE ALL"
                  className="flex-1"
                />
                <Button variant="destructive" onClick={doClear}>
                  <Trash2 className="w-4 h-4" /> Clear All
                </Button>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Calculation Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-slate-700">
          <Formula
            name="Cash Profit / Gross Profit"
            formula="Final Settlement Amount − (Quantity × Purchase Cost Incl. GST)"
          />
          <Formula
            name="Net Profit"
            formula="Cash Profit − Estimated Ad Allocation + Referrals + (Compensation − Recovery)"
          />
          <Formula
            name="Taxable Purchase Cost / Unit"
            formula="Purchase Cost Incl. GST ÷ (1 + GST Rate ÷ 100)"
          />
          <Formula
            name="Input GST / Unit"
            formula="Purchase Cost Incl. GST − Taxable Purchase Cost"
          />
          <Formula name="Margin %" formula="Profit ÷ Settlement × 100" />
          <Formula name="ROI / Profit %" formula="Profit ÷ COGS × 100" />
          <div className="pt-2 text-xs text-slate-500">
            <Badge variant="warning" className="mr-2">
              Important
            </Badge>
            Meesho fees (commission, shipping, fixed fee etc.) are shown in the
            settlement already. We do <strong>NOT</strong> subtract them again
            from Final Settlement Amount.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={
        "p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors " +
        (checked
          ? "border-emerald-500 bg-emerald-50/60"
          : "border-slate-200 hover:bg-slate-50")
      }
    >
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
    </label>
  );
}

function RatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const custom = !GST_RATES.includes(value);
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {GST_RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={
              "px-3 h-9 rounded-md text-sm font-medium border transition-colors " +
              (value === r && !custom
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
            }
          >
            {r}%
          </button>
        ))}
        {custom ? (
          <Input
            type="number"
            min={0}
            max={100}
            className="w-24 h-9"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        ) : (
          <button
            type="button"
            className="px-3 h-9 rounded-md text-sm border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
            onClick={() => onChange(value === 18 ? 9 : 18)}
          >
            + Custom
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "info";
}) {
  return (
    <div
      className={
        "rounded-lg p-3 border " +
        (tone === "info"
          ? "bg-blue-50 border-blue-100"
          : "bg-white border-slate-200")
      }
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-slate-900 mt-1">
        {value.toLocaleString("en-IN")}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Formula({ name, formula }: { name: string; formula: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
        {name}
      </div>
      <div className="font-mono text-[12.5px] text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 mt-1">
        {formula}
      </div>
    </div>
  );
}
