import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";

const LandingPage = React.lazy(() => import("../pages/LandingPage"));
const AccountDashboard = React.lazy(() => import("./AccountDashboard"));
const AdminPage = React.lazy(() => import("../pages/AdminPage"));

export function AccountApp() {
  const { user, initializing, error } = useAuth();
  const location = useLocation();
  React.useLayoutEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  if (initializing) return null;
  if (error) return <main className="p-6" role="alert">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!user) return <React.Suspense fallback={null}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="*" element={<Navigate to="/login" replace state={{from:location.pathname + location.search}} />} />
  </Routes></React.Suspense>;
  if (location.pathname === "/login") {
    const from = (location.state as {from?: string} | null)?.from;
    const next = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/login") ? from : "/";
    return <Navigate to={next} replace />;
  }
  if (location.pathname === "/admin") return <React.Suspense fallback={null}><AdminPage key={user.uid} /></React.Suspense>;
  return <React.Suspense fallback={null}><AccountDashboard key={user.uid} uid={user.uid} /></React.Suspense>;
}

