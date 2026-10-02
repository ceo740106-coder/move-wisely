import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void };
const Context = createContext<ThemeValue | null>(null);
const KEY = "movewisely-theme";

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persistTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* optional preference */ }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");
  root.style.colorScheme = theme;
}

if (typeof document !== "undefined") applyTheme(readTheme());

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const value = useMemo(() => ({
    theme,
    setTheme: (next: Theme) => {
      setThemeState(next);
      persistTheme(next);
    },
    toggleTheme: () => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      setThemeState(next);
      persistTheme(next);
    },
  }), [theme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error("ThemeProvider is missing.");
  return value;
}
