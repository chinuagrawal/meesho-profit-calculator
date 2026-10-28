import { useAuth } from "@/context/AuthContext";
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const SKUAnalysisPage = lazy(() => import("@/pages/SKUAnalysisPage"));
const SKUCostsPage = lazy(() => import("@/pages/SKUCostsPage"));
const AdvertisingPage = lazy(() => import("@/pages/AdvertisingPage"));
const GSTPage = lazy(() => import("@/pages/GSTPage"));
const ReferralPage = lazy(() => import("@/pages/ReferralPage"));
const CompensationPage = lazy(() => import("@/pages/CompensationPage"));
const BreakEvenPage = lazy(() => import("@/pages/BreakEvenPage"));
const ImportPage = lazy(() => import("@/pages/ImportPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
import { useApp } from "@/context/AppContext";

export default function App() {
  const { loading, loadError } = useApp();
  const { logout } = useAuth();
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
    <Suspense fallback={null}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/sku-analysis" element={<SKUAnalysisPage />} />
        <Route path="/sku-costs" element={<SKUCostsPage />} />
        <Route path="/advertising" element={<AdvertisingPage />} />
        <Route path="/gst" element={<GSTPage />} />
        <Route path="/referral-payments" element={<ReferralPage />} />
        <Route path="/compensation" element={<CompensationPage />} />
        <Route path="/break-even" element={<BreakEvenPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
