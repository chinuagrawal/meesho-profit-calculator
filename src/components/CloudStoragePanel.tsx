import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, Button, Alert } from "./ui";
export function CloudStoragePanel() {
  const { user } = useAuth();
  const { cloudStatus, cloudSyncError, retryCloudSync, loadCloudVersion, backupData } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const download = async () => {
    const json = await backupData();
    const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "meesho-account-backup.json"; link.click(); URL.revokeObjectURL(url);
  };
  return <Card><CardHeader><CardTitle>Account & cloud storage</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm">Signed in as {user?.phoneNumber}. <strong>{cloudStatus}</strong></p>
    <p className="text-xs text-slate-500">Changes save automatically to your private cloud account after a short delay. Signing in on another device loads the cloud copy. Newer changes from another tab or device pause saving to prevent overwrites. Unsaved changes remain on this device.</p>
    {cloudSyncError && <Alert variant="warning">{cloudSyncError}</Alert>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={retryCloudSync} disabled={busy}>Retry cloud save</Button><Button variant="outline" disabled={busy} onClick={() => { void download().catch(() => setError("Backup download failed. Try again.")); }}>Download device backup</Button><Button variant="outline" disabled={busy} onClick={async () => {
      if (!window.confirm("Load the cloud version? This replaces this account's data on this device. Download a device backup first if you have unsaved changes.")) return;
      setBusy(true); setError(""); try { await loadCloudVersion(); } catch (error) { setError(error instanceof Error ? error.message : "Could not load cloud data."); } finally { setBusy(false); }
    }}>Load cloud version</Button></div>
  </CardContent></Card>;
}
