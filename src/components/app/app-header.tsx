import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { useTheme } from "@/lib/theme";

export function AppHeader({ subtitle = "Competition chess training" }: { subtitle?: string }) {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const email = auth.user?.email ?? "";
  const initials = email ? email.slice(0, 1).toUpperCase() : "M";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg shadow-sm">
            <span className="font-display text-lg font-semibold">M</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none tracking-tight">MoveWisely</p>
            <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
            className="mw-focus grid size-10 place-items-center rounded-full border border-border bg-surface text-muted transition hover:border-primary hover:text-fg"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {auth.user && (
            <div className="hidden items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 sm:flex">
              <div className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{initials}</div>
              <span className="max-w-48 truncate text-xs text-muted">{email}</span>
            </div>
          )}
          {auth.user && (
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="mw-focus grid size-10 place-items-center rounded-full border border-border bg-surface text-muted transition hover:border-danger hover:text-danger"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
