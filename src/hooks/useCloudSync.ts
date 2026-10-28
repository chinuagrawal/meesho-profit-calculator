import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/types";
import { createStorage } from "@/services/storage";
import { CloudConflictError, cloudError, loadCloudData, saveCloudData } from "@/services/cloudStorage";
import { hasBusinessData, readSyncMarker, snapshotHash, splitSnapshot, writeSyncMarker } from "@/lib/cloudSnapshot";
export function useCloudSync(uid: string, storage: ReturnType<typeof createStorage>, data: AppData, loading: boolean) {
  const [status, setStatus] = useState("Connecting to cloud…");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const revision = useRef(0);
  const savedHash = useRef("");
  const savedJson = useRef("");
  const blocked = useRef(false);
  const inFlight = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const bootstrap = useCallback(async () => {
    const local = await storage.exportAllData();
    const marker = readSyncMarker(uid);
    const hash = await snapshotHash(splitSnapshot(local).join(""));
    const remote = await loadCloudData(uid);
    const pending = marker?.dirty || (marker?.hash && marker.hash !== hash) || (!marker && hasBusinessData(local));
    const baseRevision = marker?.revision ?? 0;
    if (pending) {
      revision.current = baseRevision; savedHash.current = marker?.hash ?? ""; savedJson.current = "";
      if ((remote?.revision ?? 0) !== baseRevision) { blocked.current = true; setError(new CloudConflictError().message); setStatus("Sync paused"); }
      else setStatus("Changes waiting to sync");
      return local;
    }
    const initial = remote?.data ?? local;
    if (remote) await storage.restoreAllData(initial);
    revision.current = remote?.revision ?? 0;
    savedHash.current = await snapshotHash(splitSnapshot(initial).join(""));
    savedJson.current = JSON.stringify(initial);
    writeSyncMarker(uid, { revision: revision.current, dirty: false, hash: savedHash.current });
    setStatus(remote ? "Saved to cloud" : "Ready to save to cloud");
    return initial;
  }, [uid, storage]);
  const sync = useCallback(async () => {
    if (loading || inFlight.current || blocked.current) return;
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJson.current) return;
    inFlight.current = true; setStatus("Saving to cloud…"); setError(null);
    try {
      writeSyncMarker(uid, { revision: revision.current, dirty: true, hash: savedHash.current });
      const result = await saveCloudData(uid, snapshot, revision.current);
      revision.current = result.revision; savedHash.current = result.hash; savedJson.current = json;
      const dirty = JSON.stringify(latest.current) !== json;
      writeSyncMarker(uid, { revision: result.revision, dirty, hash: result.hash });
      setStatus(dirty ? "Changes waiting to sync" : "Saved to cloud");
    } catch (error) { blocked.current = true; setError(cloudError(error)); setStatus("Sync paused"); }
    finally { inFlight.current = false; setTick(value => value + 1); }
  }, [uid, loading]);
  useEffect(() => {
    if (loading || JSON.stringify(data) === savedJson.current) return;
    try { writeSyncMarker(uid, { revision: revision.current, dirty: true, hash: savedHash.current }); }
    catch { blocked.current = true; setError("Device storage is full. Download a backup before closing this tab."); return; }
    if (blocked.current || inFlight.current) return;
    setStatus("Changes waiting to sync");
    const timer = window.setTimeout(() => { void sync(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [uid, data, loading, tick, sync]);
  const retry = useCallback(() => { blocked.current = false; setError(null); setTick(value => value + 1); }, []);
  const loadCloudVersion = useCallback(async () => {
    if (inFlight.current) throw new Error("Wait for the current save to finish first.");
    blocked.current = true;
    const remote = await loadCloudData(uid);
    if (!remote) throw new Error("No cloud backup exists for this account yet.");
    await storage.restoreAllData(remote.data);
    writeSyncMarker(uid, { revision: remote.revision, dirty: false, hash: remote.hash });
    window.location.reload();
  }, [uid, storage]);
  return { bootstrap, status, error, retry, loadCloudVersion };
}
