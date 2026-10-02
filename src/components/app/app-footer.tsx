import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-t border-border pt-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} MoveWisely · Competition chess training</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary" /> Your reports are protected by account-level access controls.</span>
          <span>Independent product · not affiliated with Chess.com</span>
        </div>
      </div>
    </footer>
  );
}
