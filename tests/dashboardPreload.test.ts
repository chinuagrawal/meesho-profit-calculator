// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedPage } from "@/lib/dashboardPages";
import { preloadWhenIdle } from "@/lib/preloadWhenIdle";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "connection");
});

describe("dashboard background loading", () => {
  it("shares an in-flight download and allows retry after a failed prefetch", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("ready");
    const page = cachedPage(load);
    const first = page();
    expect(page()).toBe(first);
    await expect(first).rejects.toThrow("offline");
    await expect(page()).resolves.toBe("ready");
    await expect(page()).resolves.toBe("ready");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("waits for the initial screen and loads one page at a time", async () => {
    let finish!: () => void;
    const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const second = vi.fn().mockResolvedValue(undefined);
    const stop = preloadWhenIdle([first, second]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(first).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(second).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not preload on data saver, and cancels pending work on unmount", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    preloadWhenIdle([load]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "connection");
    const stop = preloadWhenIdle([load]);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).not.toHaveBeenCalled();
  });

  it("pauses in hidden tabs and resumes when visible", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const stop = preloadWhenIdle([load]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });
});
