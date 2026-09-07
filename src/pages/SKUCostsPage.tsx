import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Tag,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Save,
  AlertTriangle,
  FileSpreadsheet,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  Badge,
  Alert,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { formatINR, parseNumeric } from "@/lib/utils";
import { calculatePurchaseGSTComponents } from "@/calculations";
import { SKUCost } from "@/types";

export default function SKUCostsPage() {
  const {
    skuCosts,
    orders,
    gstSettings,
    setSKUCost,
    bulkSetSKUCosts,
    deleteSKUCost,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "filled">(
    (searchParams.get("filter") as any) || "all",
  );
  const [showAdd, setShowAdd] = useState(false);
  const [newSKU, setNewSKU] = useState("");
  const [newName, setNewName] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newGST, setNewGST] = useState(String(gstSettings.purchaseGSTRate));
  const importInputRef = useMemo(() => {
    if (typeof document !== "undefined") {
      const el = document.createElement("input");
      el.type = "file";
      el.accept = ".xlsx,.xls,.csv";
      return el;
    }
    return null as any;
  }, []);

  useEffect(() => {
    if (filter) setSearchParams({ filter });
  }, [filter, setSearchParams]);

  const skuUnitsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      m.set(o.supplierSKU, (m.get(o.supplierSKU) ?? 0) + (o.quantity ?? 0));
    }
    return m;
  }, [orders]);

  const skuNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) {
      if (o.supplierSKU && o.productName && !m.has(o.supplierSKU)) {
        m.set(o.supplierSKU, o.productName);
      }
    }
    return m;
  }, [orders]);

  const mergedSKUs = useMemo(() => {
    const existing = new Map(skuCosts.map((s) => [s.supplierSKU, s]));
    const now = new Date().toISOString();
    const all: SKUCost[] = [...skuCosts];
    for (const [sku, name] of skuNameMap.entries()) {
      if (!existing.has(sku)) {
        all.push({
          supplierSKU: sku,
          productName: name,
          purchaseCostInclGST: null,
          gstRate: gstSettings.purchaseGSTRate,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return all;
  }, [skuCosts, skuNameMap, gstSettings]);

  const filtered = useMemo(() => {
    let list = mergedSKUs;
    if (filter === "missing") {
      list = list.filter(
        (s) =>
          s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
      );
    } else if (filter === "filled") {
      list = list.filter(
        (s) =>
          s.purchaseCostInclGST !== null && s.purchaseCostInclGST !== undefined,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.supplierSKU.toLowerCase().includes(q) ||
          (s.productName || "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => {
      const am = a.purchaseCostInclGST === null ? 0 : 1;
      const bm = b.purchaseCostInclGST === null ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.supplierSKU.localeCompare(b.supplierSKU);
    });
  }, [mergedSKUs, filter, search]);

  const missingCount = mergedSKUs.filter(
    (s) =>
      s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined,
  ).length;

  const handleExport = () => {
    const rows = mergedSKUs.map((s) => {
      const per = calculatePurchaseGSTComponents(
        s.purchaseCostInclGST,
        s.gstRate ?? gstSettings.purchaseGSTRate,
      );
      const units = skuUnitsMap.get(s.supplierSKU) ?? 0;
      return {
        "Supplier SKU": s.supplierSKU,
        "Product Name": s.productName ?? skuNameMap.get(s.supplierSKU) ?? "",
        Units: units,
        "Purchase Cost / Unit Incl. GST": s.purchaseCostInclGST,
        "GST Rate %": s.gstRate ?? gstSettings.purchaseGSTRate,
        "Taxable Cost / Unit": per.taxableCost,
        "Input GST / Unit": per.inputGST,
        "Total COGS (Incl GST)":
          s.purchaseCostInclGST !== null ? s.purchaseCostInclGST * units : null,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU Costs");
    XLSX.writeFile(wb, "Meesho-SKU-Costs.xlsx");
  };

  const handleImport = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".xlsx,.xls,.csv";
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        const updates: {
          supplierSKU: string;
          purchaseCostInclGST: number | null;
          gstRate?: number;
          productName?: string;
        }[] = [];
        for (const r of rows) {
          const sku =
            r["Supplier SKU"] ?? r["SKU"] ?? r["supplier sku"] ?? r["sku"];
          if (!sku) continue;
          const costRaw =
            r["Purchase Cost / Unit Incl. GST"] ??
            r["Cost"] ??
            r["Purchase Cost"] ??
            r["cost"];
          const cost = parseNumeric(costRaw);
          const gstRaw =
            r["GST Rate %"] ?? r["GST Rate"] ?? r["GST %"] ?? r["gst"];
          const gst = parseNumeric(gstRaw);
          const name = r["Product Name"] ?? r["Product"];
          updates.push({
            supplierSKU: String(sku),
            purchaseCostInclGST: cost,
            gstRate: gst ?? undefined,
            productName: name ? String(name) : undefined,
          });
        }
        if (updates.length > 0) {
          bulkSetSKUCosts(updates);
          alert(`Imported ${updates.length} SKU costs.`);
        } else {
          alert("No SKU rows found. Ensure file has SKU and Cost columns.");
        }
      } catch (err: any) {
        alert("Import failed: " + (err?.message ?? err));
      }
    };
    inp.click();
  };

  const handleAdd = () => {
    if (!newSKU.trim()) return;
    const costNum = parseNumeric(newCost);
    setSKUCost(
      newSKU.trim(),
      costNum,
      parseNumeric(newGST) ?? gstSettings.purchaseGSTRate,
      newName.trim() || undefined,
    );
    setNewSKU("");
    setNewName("");
    setNewCost("");
    setNewGST(String(gstSettings.purchaseGSTRate));
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" />
            SKU Costs
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Enter actual purchase price <strong>INCLUDING GST</strong> per unit.
            GST is automatically separated into taxable cost and input GST.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button size="sm" onClick={() => setShowAdd((x) => !x)}>
            <Plus className="w-4 h-4" /> Add SKU
          </Button>
        </div>
      </div>

      {missingCount > 0 && (
        <Alert variant="warning" className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong>
              {missingCount} SKU{missingCount !== 1 ? "s" : ""}
            </strong>{" "}
            have missing purchase costs. Profit calculation will be shown as "—"
            for these SKUs until you enter a cost.
          </div>
        </Alert>
      )}

      {showAdd && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Add / Define SKU</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAdd(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Supplier SKU *</Label>
              <Input
                value={newSKU}
                onChange={(e) => setNewSKU(e.target.value)}
                placeholder="e.g. SKU001"
              />
            </div>
            <div>
              <Label>Product Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Purchase Cost (Incl GST, ₹)</Label>
              <Input
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                type="number"
                placeholder="e.g. 118"
              />
            </div>
            <div>
              <Label>GST Rate %</Label>
              <div className="flex gap-2">
                <Select
                  value={newGST}
                  onChange={(e) => setNewGST(e.target.value)}
                  className="flex-1"
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                  <option value="custom">Custom...</option>
                </Select>
                {newGST === "custom" && (
                  <Input
                    type="number"
                    placeholder="%"
                    className="w-20"
                    onChange={(e) => setNewGST(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd}>
                <Save className="w-4 h-4" /> Save SKU
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search SKU or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-44"
          >
            <option value="all">All SKUs ({mergedSKUs.length})</option>
            <option value="missing">Missing cost ({missingCount})</option>
            <option value="filled">
              Filled ({mergedSKUs.length - missingCount})
            </option>
          </Select>
          <Badge variant="muted">
            {filtered.length} of {mergedSKUs.length} shown
          </Badge>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold px-4 py-3">
                  Supplier SKU
                </th>
                <th className="text-left font-semibold px-4 py-3">
                  Product Name
                </th>
                <th className="text-right font-semibold px-4 py-3">Units</th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                  Purchase Cost / Unit (Incl GST)
                </th>
                <th className="text-center font-semibold px-4 py-3">
                  GST Rate
                </th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                  Taxable Cost / Unit
                </th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                  Input GST / Unit
                </th>
                <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                  Total COGS (Incl GST)
                </th>
                <th className="text-center font-semibold px-4 py-3">Status</th>
                <th className="text-center font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-500">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <div className="font-medium">No SKUs found</div>
                    <div className="text-xs mt-1">
                      Import a Meesho report to auto-populate SKUs, or click
                      "Add SKU".
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((sku) => (
                <SKURow
                  key={sku.supplierSKU}
                  sku={sku}
                  units={skuUnitsMap.get(sku.supplierSKU) ?? 0}
                  defaultName={skuNameMap.get(sku.supplierSKU)}
                  defaultGST={gstSettings.purchaseGSTRate}
                  onUpdate={(cost, rate) =>
                    setSKUCost(sku.supplierSKU, cost, rate, sku.productName)
                  }
                  onDelete={() => {
                    if (confirm(`Delete SKU cost for ${sku.supplierSKU}?`))
                      deleteSKUCost(sku.supplierSKU);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SKURow({
  sku,
  units,
  defaultName,
  defaultGST,
  onUpdate,
  onDelete,
}: {
  sku: SKUCost;
  units: number;
  defaultName?: string;
  defaultGST: number;
  onUpdate: (cost: number | null, gst?: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState(
    sku.purchaseCostInclGST !== null ? String(sku.purchaseCostInclGST) : "",
  );
  const [gstRate, setGstRate] = useState(String(sku.gstRate ?? defaultGST));

  const displayGST = parseNumeric(gstRate) ?? sku.gstRate ?? defaultGST;
  const per = calculatePurchaseGSTComponents(parseNumeric(cost), displayGST);
  const totalCOGS =
    parseNumeric(cost) !== null ? (parseNumeric(cost) ?? 0) * units : null;
  const isMissing =
    sku.purchaseCostInclGST === null || sku.purchaseCostInclGST === undefined;

  const save = () => {
    const gstNum = parseNumeric(gstRate);
    onUpdate(parseNumeric(cost), gstNum ?? undefined);
    setEditing(false);
  };

  return (
    <tr className={isMissing ? "bg-yellow-50/60" : "hover:bg-slate-50/60"}>
      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">
        {sku.supplierSKU}
      </td>
      <td className="px-4 py-2.5 text-slate-700 max-w-[240px] truncate">
        {sku.productName || defaultName || "—"}
      </td>
      <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
        {units.toLocaleString("en-IN")}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-36 ml-auto text-right"
            placeholder="0.00"
          />
        ) : (
          <button
            className="text-right hover:bg-white border border-transparent hover:border-slate-200 rounded-md px-2 py-1 w-36 ml-auto focus:outline-none"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {sku.purchaseCostInclGST !== null ? (
              <span className={isMissing ? "" : "font-medium"}>
                {formatINR(sku.purchaseCostInclGST)}
              </span>
            ) : (
              <span className="text-yellow-600 font-medium">Enter cost...</span>
            )}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-center tabular-nums">
        <Select
          value={String(displayGST)}
          onChange={(e) => {
            setGstRate(e.target.value);
            const gstNum = parseNumeric(e.target.value);
            onUpdate(parseNumeric(cost), gstNum ?? undefined);
          }}
          className="w-24 mx-auto text-sm h-8"
        >
          <option value="0">0%</option>
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18">18%</option>
          <option value="28">28%</option>
        </Select>
      </td>
      <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
        {formatINR(per.taxableCost)}
      </td>
      <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
        {formatINR(per.inputGST)}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
        {formatINR(totalCOGS)}
      </td>
      <td className="px-4 py-2.5 text-center">
        {isMissing ? (
          <Badge variant="warning">Cost Missing</Badge>
        ) : (
          <Badge variant="success">Filled</Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Delete SKU cost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}
