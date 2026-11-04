// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({
  dateFilterType: "custom", dateRange: { start: new Date("2026-10-01"), end: new Date("2026-10-31") },
  customDateFrom: new Date("2026-10-01"), customDateTo: new Date("2026-10-31"),
  setDateFilterType: vi.fn(), setCustomDateRange: vi.fn(), clearDateFilter: vi.fn(), enrichedOrders: [], filteredEnrichedOrders: [],
}));
vi.mock("@/context/AppContext", () => ({ useApp: () => state }));
import { DateRangeFilter } from "@/components/DateRangeFilter";
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 16, right: 160, top: 80, bottom: 120, width: 144, height: 40, x: 16, y: 80, toJSON() {} });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(380);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("renders outside clipping containers and fits a narrow viewport", () => {
  const view = render(<div style={{ overflow: "hidden", width: 160 }}><DateRangeFilter /></div>);
  fireEvent.click(screen.getByRole("button", { name: "Date range", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Date range filter" });
  expect(view.container.contains(dialog)).toBe(false);
  expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(12);
  expect(parseFloat(dialog.style.left) + parseFloat(dialog.style.width)).toBeLessThanOrEqual(308);
  expect(screen.getByLabelText("From")).toBeTruthy(); expect(screen.getByLabelText("To")).toBeTruthy();
});
it("opens above the trigger when there is insufficient room below", () => {
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ left: 16, right: 160, top: 530, bottom: 570, width: 144, height: 40, x: 16, y: 530, toJSON() {} });
  render(<DateRangeFilter />); fireEvent.click(screen.getByRole("button", { name: "Date range", exact: true }));
  const dialog = screen.getByRole("dialog");
  expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(12);
  expect(parseFloat(dialog.style.top) + Math.min(382, parseFloat(dialog.style.maxHeight))).toBeLessThan(530);
});
it("repositions after resize and closes with Escape", () => {
  render(<DateRangeFilter />); const trigger = screen.getByRole("button", { name: "Date range", exact: true }); fireEvent.click(trigger);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 240 }); fireEvent(window, new Event("resize"));
  const dialog = screen.getByRole("dialog");
  expect(parseFloat(dialog.style.width)).toBe(216);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
});
