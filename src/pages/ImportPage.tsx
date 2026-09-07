import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Alert,
  Badge,
  Checkbox,
} from "@/components/ui";
import { parseWorkbookFromFile } from "@/services/excelParser";
import { ParsedWorkbook, ImportSummary } from "@/types";
import { formatDate } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

function SummaryItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones = {
    default: "text-slate-900",
    good: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-yellow-600",
  };
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={cn("text-sm font-semibold", tones[tone])}>{value}</span>
    </div>
  );
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { orders, importParsedData } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasExisting = orders.length > 0;

  const processFile = useCallback(async (f: File) => {
    setError(null);
    setParsed(null);
    setImportSuccess(false);
    const valid =
      f.name.endsWith(".xlsx") ||
      f.name.endsWith(".xls") ||
      f.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      f.type === "application/vnd.ms-excel";
    if (!valid) {
      setError("Please upload a valid Excel file (.xlsx or .xls)");
      setFile(null);
      return;
    }
    if (f.size === 0) {
      setError("File is empty.");
      setFile(null);
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const result = await parseWorkbookFromFile(f);
      result.summary.duplicateOrders = 0;
      setParsed(result);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Failed to parse Excel file. Please ensure it is a valid Meesho report."
      );
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const doImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      await importParsedData(parsed, overwrite);
      setImportSuccess(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (err: any) {
      setError(err?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const summary: ImportSummary | null = parsed?.summary ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Data</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Upload your Meesho Excel payment report to begin. All processing happens
          locally in your browser — no data is uploaded anywhere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Upload Meesho Report
          </CardTitle>
          <CardDescription>
            Accepts .xlsx and .xls files. Expected sheets: Order Payments, Ads
            Cost, Referral Payments, Compensation and Recovery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
              dragOver
                ? "bg-emerald-50 border-emerald-400"
                : "bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
              </div>
              {parsing ? (
                <div className="text-sm text-slate-600">
                  Parsing file... <span className="animate-pulse">⏳</span>
                </div>
              ) : file ? (
                <div>
                  <div className="font-medium text-slate-900">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB · Click to change file
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-slate-800">
                    Drag &amp; drop your Excel file here
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    or click anywhere in this area to browse
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </Alert>
          )}

          {importSuccess && (
            <Alert variant="success" className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Data imported successfully! Redirecting to dashboard...
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Import Summary
            </CardTitle>
            <CardDescription>
              File: <span className="font-medium text-slate-700">{summary.fileName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Sheets Detected
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summary.sheetsFound.map((s) => (
                  <Badge key={s} variant="info">
                    {s}
                  </Badge>
                ))}
              </div>
              <div className="h-4" />
              <SummaryItem label="Orders found" value={summary.ordersFound} />
              <SummaryItem
                label="Valid orders"
                value={summary.validOrders}
                tone="good"
              />
              <SummaryItem label="Unique SKUs" value={summary.uniqueSKUs} />
              <SummaryItem label="Total quantity" value={summary.totalQuantity} />
              <SummaryItem
                label="Missing SKU"
                value={summary.missingSKU}
                tone={summary.missingSKU ? "warn" : "good"}
              />
              <SummaryItem
                label="Missing settlement"
                value={summary.missingSettlement}
                tone={summary.missingSettlement ? "bad" : "good"}
              />
              {summary.dateRangeStart && summary.dateRangeEnd && (
                <>
                  <SummaryItem
                    label="From"
                    value={formatDate(summary.dateRangeStart)}
                  />
                  <SummaryItem label="To" value={formatDate(summary.dateRangeEnd)} />
                </>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Additional Data
              </div>
              <SummaryItem
                label="Ads entries"
                value={summary.adsEntriesFound}
                tone={summary.adsEntriesFound ? "good" : "default"}
              />
              <SummaryItem
                label="Referral payments"
                value={summary.referralPaymentsFound}
              />
              <SummaryItem
                label="Compensation entries"
                value={summary.compensationEntriesFound}
              />
              <div className="h-4" />
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Warnings ({summary.warnings.length})
              </div>
              {summary.warnings.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No warnings</div>
              ) : (
                <ul className="space-y-1.5">
                  {summary.warnings.slice(0, 5).map((w, i) => (
                    <li
                      key={i}
                      className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-md p-2 flex gap-2"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="h-3" />
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Errors ({summary.errors.length})
              </div>
              {summary.errors.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No errors</div>
              ) : (
                <ul className="space-y-1.5">
                  {summary.errors.slice(0, 5).map((w, i) => (
                    <li
                      key={i}
                      className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md p-2 flex gap-2"
                    >
                      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>

          <div className="px-5 pb-5 space-y-4">
            {hasExisting && (
              <label className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Checkbox
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <div>
                  <div className="text-sm font-medium text-amber-900">
                    <Trash2 className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Overwrite existing data
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    You have {orders.length} existing orders. If unchecked, new
                    orders will be merged (duplicates by Sub Order No skipped).
                  </div>
                </div>
              </label>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setFile(null);
                  setError(null);
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={doImport}
                disabled={importing || summary.errors.length > 0 && summary.validOrders === 0}
              >
                {importing ? "Importing..." : "Import Data"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
