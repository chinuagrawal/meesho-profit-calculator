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
  const { loading } = useApp();

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
