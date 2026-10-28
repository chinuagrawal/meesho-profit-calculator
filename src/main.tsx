import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";

const AccountDashboard = React.lazy(() => import("./components/AccountDashboard"));

function AccountApp() {
  const { user, initializing, error } = useAuth();
  if (initializing) return null;
  if (error) return <main className="p-6" role="alert">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!user) return <LoginPage />;
  return <React.Suspense fallback={null}><AccountDashboard key={user.uid} uid={user.uid} /></React.Suspense>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><AccountApp /></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
