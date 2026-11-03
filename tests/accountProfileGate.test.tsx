// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("@/services/accountProfile", () => ({ loadAccountProfile: api.load, saveAccountProfile: api.save }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));
import AccountProfileGate from "@/components/AccountProfileGate";
const names = { fullName: "Seller Name", storeName: "Seller Store" };
beforeEach(() => vi.resetAllMocks()); afterEach(cleanup);
function open(uid = "owner") { return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccountProfileGate uid={uid} key={uid}><h1>Private dashboard</h1></AccountProfileGate></MemoryRouter>); }
it("requires both names after OTP and waits for a confirmed save before opening the dashboard", async () => {
  api.load.mockResolvedValue(null);
  let finish!: (value: typeof names) => void;
  api.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  open(); await screen.findByRole("heading", { name: "Make it your own." });
  expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: names.fullName } });
  fireEvent.change(screen.getByLabelText("Store name"), { target: { value: names.storeName } });
  fireEvent.click(screen.getByRole("button", { name: "Save & open dashboard" }));
  expect(api.save).toHaveBeenCalledWith("owner", names);
  expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
  await act(async () => { finish(names); });
  expect(await screen.findByRole("heading", { name: "Private dashboard" })).toBeTruthy();
});
it("skips signup details for returning users with a saved profile", async () => {
  api.load.mockResolvedValue(names); open();
  await screen.findByRole("heading", { name: "Private dashboard" });
  expect(screen.queryByLabelText("Full name")).toBeNull(); expect(api.save).not.toHaveBeenCalled();
});
it("keeps entered details available after a failed save", async () => {
  api.load.mockResolvedValue(null); api.save.mockRejectedValue(new Error("Save failed. Retry.")); open();
  await screen.findByLabelText("Full name");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: names.fullName } });
  fireEvent.change(screen.getByLabelText("Store name"), { target: { value: names.storeName } });
  fireEvent.click(screen.getByRole("button", { name: "Save & open dashboard" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(names.fullName);
  expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
});
it("does not treat a connection failure as a new signup", async () => {
  api.load.mockRejectedValue(new Error("Offline")); open(); await screen.findByRole("alert");
  expect(screen.queryByLabelText("Full name")).toBeNull(); expect(api.save).not.toHaveBeenCalled();
});
