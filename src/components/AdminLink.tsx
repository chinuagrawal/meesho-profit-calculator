import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminSession } from "@/services/adminStorage";
import { useAuth } from "@/context/AuthContext";
export function AdminLink() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(false);
    const controller = new AbortController();
    if (user) void adminSession(controller.signal).then(result => { if (!controller.signal.aborted) setEnabled(result.admin); }).catch(() => {});
    return () => controller.abort();
  }, [user?.uid]);
  return enabled ? <Link to="/admin" className="font-semibold text-emerald-700 underline">Admin panel</Link> : null;
}
