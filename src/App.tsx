import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { dashboardPages } from "@/lib/dashboardPages";
import { preloadWhenIdle } from "@/lib/preloadWhenIdle";
import { useApp } from "@/context/AppContext";

export default function App() {
  const { loading, loadError } = useApp();
  const { logout } = useAuth();
  useEffect(() => {
    if (!loading && !loadError) return preloadWhenIdle(dashboardPages.map(page => page.load));
  }, [loading, loadError]);
  if (loadError) return <main className="min-h-screen p-6 bg-slate-50"><div className="max-w-lg mx-auto rounded-xl bg-white border p-5 space-y-3"><h1 className="font-semibold">Could not open your account data</h1><p role="alert">{loadError}</p><p className="text-sm text-slate-500">Your device data has not been replaced. Check Firestore setup and your connection before retrying.</p><button className="underline" onClick={() => window.location.reload()}>Retry</button> <button className="underline" onClick={() => { void logout().catch(() => window.location.reload()); }}>Sign out</button></div></main>;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          <div className="mt-4 text-slate-600 text-sm font-medium">
            Loading Meesho Profit Calculator...
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {dashboardPages.map(({ path, Component }) => <Route key={path} path={path} element={<Component />} />)}
        <Route path="*" element={<DefaultPage />} />
      </Route>
    </Routes>
  );
}

const DefaultPage = dashboardPages[0].Component;
