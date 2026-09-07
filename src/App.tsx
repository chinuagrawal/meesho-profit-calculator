import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import OrdersPage from "@/pages/OrdersPage";
import SKUAnalysisPage from "@/pages/SKUAnalysisPage";
import SKUCostsPage from "@/pages/SKUCostsPage";
import AdvertisingPage from "@/pages/AdvertisingPage";
import GSTPage from "@/pages/GSTPage";
import ReferralPage from "@/pages/ReferralPage";
import CompensationPage from "@/pages/CompensationPage";
import BreakEvenPage from "@/pages/BreakEvenPage";
import ImportPage from "@/pages/ImportPage";
import SettingsPage from "@/pages/SettingsPage";
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
  );
}
