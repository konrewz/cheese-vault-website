import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "cheese-vault:theme";
type Theme = "light" | "dark";
const valid = (value: unknown): value is Theme => value === "light" || value === "dark";
function savedTheme(): Theme | undefined {
  try { const value = localStorage.getItem(THEME_KEY); return valid(value) ? value : undefined; }
  catch { return undefined; }
}
function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#171411" : "#faf7ef");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());
  const explicit = useRef(!!savedTheme());
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const followSystem = () => { if (!explicit.current) setTheme(systemTheme()); };
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      const saved = savedTheme();
      explicit.current = !!saved;
      setTheme(saved ?? systemTheme());
    };
    media?.addEventListener("change", followSystem);
    window.addEventListener("storage", sync);
    return () => {
      media?.removeEventListener("change", followSystem);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const label = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
  return <button type="button" className="theme-toggle" aria-label={label} title={label}
    onClick={() => {
      const next = theme === "light" ? "dark" : "light";
      explicit.current = true;
      try { localStorage.setItem(THEME_KEY, next); } catch { /* In-memory choice still works. */ }
      applyTheme(next);
      setTheme(next);
    }}>
    {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
  </button>;
}
