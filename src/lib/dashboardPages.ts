import { lazy } from "react";

// Navigation and prefetching share a promise, so an early click never starts
// another download. A failed background request can be retried on navigation.
export function cachedPage<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => pending ??= load().catch(error => {
    pending = undefined;
    throw error;
  });
}

export const dashboardPages = [
  { path: "/", load: cachedPage(() => import("@/pages/DashboardPage")) },
  { path: "/orders", load: cachedPage(() => import("@/pages/OrdersPage")) },
  { path: "/sku-analysis", load: cachedPage(() => import("@/pages/SKUAnalysisPage")) },
  { path: "/sku-costs", load: cachedPage(() => import("@/pages/SKUCostsPage")) },
  { path: "/advertising", load: cachedPage(() => import("@/pages/AdvertisingPage")) },
  { path: "/gst", load: cachedPage(() => import("@/pages/GSTPage")) },
  { path: "/referral-payments", load: cachedPage(() => import("@/pages/ReferralPage")) },
  { path: "/compensation", load: cachedPage(() => import("@/pages/CompensationPage")) },
  { path: "/break-even", load: cachedPage(() => import("@/pages/BreakEvenPage")) },
  { path: "/import", load: cachedPage(() => import("@/pages/ImportPage")) },
  { path: "/settings", load: cachedPage(() => import("@/pages/SettingsPage")) },
].map(page => ({ ...page, Component: lazy(page.load) }));

export function preloadDashboardPage(path: string) {
  const page = dashboardPages.find(page => page.path === path.split(/[?#]/)[0]);
  void page?.load().catch(() => { /* A background miss must not interrupt navigation. */ });
}
