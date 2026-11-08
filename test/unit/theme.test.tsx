import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ThemeToggle, THEME_KEY } from "../../src/ThemeToggle";

function media(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = { matches: dark, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) };
  vi.stubGlobal("matchMedia", () => query);
  return (value: boolean) => act(() => { query.matches = value; listeners.forEach(cb => cb()); });
}
describe("theme preferences", () => {
  it("follows system changes until an explicit choice, then persists that choice", async () => {
    const change = media(true);
    render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    change(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    change(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("restores a saved choice instead of the OS theme", () => {
    media(true); localStorage.setItem(THEME_KEY, "light");
    const view = render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe("light");
    view.unmount(); render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("ignores invalid preferences and handles cross-tab changes and clearing", () => {
    media(true); localStorage.setItem(THEME_KEY, "broken"); render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    localStorage.setItem(THEME_KEY, "light");
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY })));
    expect(document.documentElement.dataset.theme).toBe("light");
    localStorage.clear();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: null })));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("keeps switching available when storage is denied", async () => {
    const change = media(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    change(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
