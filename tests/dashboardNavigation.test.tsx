// @vitest-environment jsdom
import React, { lazy } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const pending = vi.hoisted(() => ({ resolve: (_value: { default: () => React.JSX.Element }) => {} }));
vi.mock("@/lib/dashboardPages", () => ({
  dashboardPages: [
    { path: "/", Component: () => <h1>Overview ready</h1>, load: vi.fn() },
    { path: "/orders", Component: lazy(() => new Promise(resolve => { pending.resolve = resolve; })), load: vi.fn() },
  ],
  preloadDashboardPage: vi.fn(),
}));
vi.mock("@/lib/preloadWhenIdle", () => ({ preloadWhenIdle: () => () => {} }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "owner" }, logout: vi.fn() }) }));
vi.mock("@/context/AppContext", () => ({ useApp: () => ({
  loading: false, loadError: null, orders: [], skuCosts: [], enrichedOrders: [], filteredEnrichedOrders: [], cloudStatus: "Saved", dateFilterType: "all",
}) }));
import App from "@/App";
import { preloadDashboardPage } from "@/lib/dashboardPages";
afterEach(cleanup);

it("preloads on intent and keeps navigation and account controls mounted while a page downloads", async () => {
  render(<MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Overview ready" })).toBeTruthy();
  const orders = screen.getByRole("link", { name: "Orders" });
  const signOut = screen.getByRole("button", { name: "Sign out" });
  fireEvent.mouseEnter(orders);
  fireEvent.focus(orders);
  fireEvent.touchStart(orders);
  expect(preloadDashboardPage).toHaveBeenCalledWith("/orders");
  fireEvent.click(orders);
  expect(screen.getByRole("button", { name: "Sign out" })).toBe(signOut);
  expect(screen.getByRole("link", { name: "Orders" })).toBe(orders);
  await act(async () => { pending.resolve({ default: () => <h1>Orders ready</h1> }); });
  expect(await screen.findByRole("heading", { name: "Orders ready" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBe(signOut);
});
