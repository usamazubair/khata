import { motion } from "motion/react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, LogOut, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pageVariants, spring } from "@/lib/motion";
import { cx } from "./ui";

/* Each module is hand-built, so its navbar is a fixed list. */
export const MODULE_NAV = {
  transactions: {
    icon: "📒",
    label: "Transactions",
    links: [
      { to: "/transactions", label: "Overview", end: true },
      { to: "/transactions/entries", label: "Transactions" },
      { to: "/transactions/categories", label: "Categories" },
      { to: "/transactions/fixed", label: "Fixed Transactions" },
      { to: "/transactions/goals", label: "Goals" },
      { to: "/transactions/budgets", label: "Budgets" },
    ],
  },
  workout: {
    icon: "🏋️",
    label: "Workout",
    links: [
      { to: "/workout", label: "Overview", end: true },
      { to: "/workout/sessions", label: "Sessions" },
      { to: "/workout/exercises", label: "Exercises" },
    ],
  },
} as const;

export type ModuleKey = keyof typeof MODULE_NAV;

function NavTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="relative shrink-0 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap">
      {({ isActive }) => (
        <>
          {isActive && (
            /* One shared element slides between tabs instead of each tab
               flipping its own background on. */
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 rounded-lg border border-accent/30 bg-accent/12"
              transition={spring}
            />
          )}
          <span className={cx("relative transition-colors", isActive ? "font-semibold text-accent" : "text-muted hover:text-ink")}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Navbar({ module, admin }: { module?: ModuleKey; admin?: boolean }) {
  const { user, signOut, isAdmin } = useAuth();
  const mod = module ? MODULE_NAV[module] : null;

  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1.5 border-b border-rule bg-page/80 px-6 py-3 backdrop-blur-xl">
      {mod || admin ? (
        <>
          <Link
            to="/"
            className="flex shrink-0 items-center gap-0.5 rounded-lg py-1.5 pr-2.5 pl-1.5 text-[12.5px] text-muted transition-colors hover:bg-page2 hover:text-ink"
          >
            <ChevronLeft size={15} /> Modules
          </Link>
          <span className="mr-3 shrink-0 border-l border-rule pl-3 font-display text-[15px] font-semibold whitespace-nowrap">
            {mod ? `${mod.icon} ${mod.label}` : "Settings"}
          </span>
        </>
      ) : (
        <Link to="/" className="mr-4 shrink-0 font-display text-[17px] font-extrabold tracking-tight">
          📒 Khata
        </Link>
      )}

      <div className="flex flex-1 gap-0.5 overflow-x-auto">
        {mod?.links.map((l) => (
          <NavTab key={l.to} to={l.to} label={l.label} end={"end" in l ? l.end : undefined} />
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {isAdmin && !admin && (
          <Link
            to="/users"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-page2 hover:text-ink"
          >
            <Users size={14} /> Users
          </Link>
        )}
        <span className="hidden max-w-[150px] truncate text-[12.5px] text-muted sm:block" title={user?.email}>
          {user?.name || user?.email}
        </span>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={signOut}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rule px-3.5 py-1.5 text-[12.5px] text-muted transition-colors hover:border-critical hover:text-critical"
        >
          <LogOut size={13} /> Logout
        </motion.button>
      </div>
    </nav>
  );
}

/** Wraps a page's content so route changes animate consistently. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pathname } = useLocation();
  return (
    <motion.main
      key={pathname}
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cx("mx-auto max-w-5xl px-5 pt-8 pb-16", className)}
    >
      {children}
    </motion.main>
  );
}
