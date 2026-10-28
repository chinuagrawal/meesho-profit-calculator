// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { accountFixture } from "./accountDataFixture";
const api = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn() }));
vi.mock("@/services/adminStorage", () => ({ listAdminAccounts: api.list, loadAdminAccount: api.load, AdminAccessError: class extends Error {} }));
import AdminPage from "@/pages/AdminPage";
import { AdminAccessError } from "@/services/adminStorage";
const a = { uid: "A", phoneNumber: "+919999999991", email: null, disabled: false, createdAt: "2026-01-01", lastSignInAt: null };
const b = { ...a, uid: "B", phoneNumber: "+919999999992" };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ users: [a, b], nextPageToken: null }); });
afterEach(cleanup);
function open() { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminPage /></MemoryRouter>); }
it("shows saved reports and source fields without writing to device storage", async () => {
  const data = accountFixture();
  api.load.mockResolvedValue({ account: a, data, revision: 1, updatedAt: null });
  const write = vi.spyOn(Storage.prototype, "setItem");
  open(); fireEvent.click(await screen.findByRole("button", { name: /9999999991/ }));
  await screen.findByText("Net cash profit");
  fireEvent.click(screen.getByRole("tab", { name: "Orders" }));
  expect(screen.getByText("sub-1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View fields for record 1" }));
  expect(screen.getByText(/"rawFields":/)).toBeTruthy();
  expect(write).not.toHaveBeenCalled(); write.mockRestore();
});
it("does not display an old account response after a quick switch", async () => {
  let finish!: (value: unknown) => void;
  api.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  api.load.mockResolvedValueOnce({ account: b, data: null, revision: null, updatedAt: null });
  open();
  fireEvent.click(await screen.findByRole("button", { name: /9999999991/ }));
  fireEvent.click(screen.getByRole("button", { name: /9999999992/ }));
  await screen.findByText("No cloud report yet");
  await act(async () => { finish({ account: a, data: accountFixture(), revision: 1, updatedAt: null }); });
  expect(screen.queryByText("Net cash profit")).toBeNull();
});
it("clears the account list when backend authorization is denied", async () => {
  api.list.mockRejectedValue(new AdminAccessError("Access denied")); open();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /9999999991/ })).toBeNull();
});
