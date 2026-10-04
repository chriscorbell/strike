import { ChartLine, Dumbbell, House, Settings, Utensils, Zap, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { cn } from "../lib/cn.ts";
import { spring } from "../lib/motion.ts";
import { usePendingJobs } from "../lib/queries.ts";
import { CoachStatus } from "./CoachStatus.tsx";

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Today", icon: House, end: true },
  { to: "/meals", label: "Meals", icon: Utensils },
  { to: "/progress", label: "Progress", icon: ChartLine },
  { to: "/plan", label: "Plan", icon: Dumbbell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <Zap size={16} strokeWidth={2.5} fill="currentColor" aria-hidden />
      </span>
      Strike
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pending = usePendingJobs();
  const { pathname } = useLocation();
  // Full-screen tasks hide the phone tab bar and own the bottom of the screen.
  const focusMode = pathname.startsWith("/sessions/") || pathname.startsWith("/meals/prep/") || pathname === "/settings/profile";

  return (
    <div className="min-h-[100dvh] lg:pl-60">
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  isActive ? "text-ink" : "text-ink-3 hover:bg-surface hover:text-ink-2",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={spring}
                      className="absolute inset-0 -z-10 rounded-xl bg-raised"
                      aria-hidden
                    />
                  )}
                  <item.icon size={18} className={isActive ? "text-accent" : undefined} aria-hidden />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <CoachStatus jobs={pending.data ?? []} />
        </div>
      </aside>

      <div id="main" className="relative isolate">
        {children}
      </div>

      {/* Phone tab bar */}
      {!focusMode && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-safe backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                      isActive ? "text-ink" : "text-ink-3",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative flex h-7 w-12 items-center justify-center">
                        {isActive && (
                          <motion.span
                            layoutId="tab-active"
                            transition={spring}
                            className="absolute inset-0 rounded-full bg-accent-soft"
                            aria-hidden
                          />
                        )}
                        <item.icon size={20} className={cn("relative", isActive && "text-accent")} aria-hidden />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
