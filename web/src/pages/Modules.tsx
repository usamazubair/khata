import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hoverLift, spring, staggerParent, riseItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { EmptyState, PageHeader, Pill } from "@/components/ui";
import type { Module } from "@/lib/types";

// Slug -> the client route its card opens, and the colour it wears. Giving
// each module its own hue makes the home screen readable at a glance.
const ROUTES: Record<string, string> = { transactions: "/transactions", workout: "/workout" };
const TINTS: Record<string, string> = {
  transactions: "var(--series-1)",
  workout: "var(--series-2)",
};
const FALLBACK_TINT = "var(--accent-3)";

export default function Modules() {
  const { isAdmin } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<Module[]>("/api/modules")
      .then(setModules)
      .catch((e) => setError((e as Error).message));
  }, []);

  const visible = modules.filter((m) => m.active || isAdmin);

  return (
    <>
      <Navbar />
      <Page>
        <PageHeader eyebrow="Khata" title="Modules" />

        {error && <EmptyState>{error}</EmptyState>}
        {!error && visible.length === 0 && (
          <EmptyState>No modules have been enabled for you yet.</EmptyState>
        )}

        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4"
        >
          {visible.map((m) => (
            <motion.div key={m.id} variants={riseItem} whileHover={hoverLift} transition={spring}>
              <Link
                to={ROUTES[m.slug] ?? "/"}
                style={{ ["--tint" as string]: TINTS[m.slug] ?? FALLBACK_TINT }}
                className="surface group relative flex h-full flex-col overflow-hidden p-6 transition-colors hover:border-[var(--tint)]"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--tint)" }} />
                {/* A wash that deepens on hover, so the card feels alive. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity duration-300 group-hover:opacity-20"
                  style={{ background: "radial-gradient(120% 90% at 0% 0%, var(--tint) 0%, transparent 60%)" }}
                />
                <motion.span
                  className="mb-3 flex size-12 items-center justify-center rounded-xl text-2xl leading-none"
                  style={{ background: "color-mix(in oklab, var(--tint) 16%, transparent)" }}
                  whileHover={{ scale: 1.12, rotate: -6 }}
                  transition={spring}
                >
                  {m.icon}
                </motion.span>
                <span className="font-display text-lg font-bold">{m.name}</span>
                <span className="mt-1 text-[12.5px] text-muted">{m.description}</span>
                {!m.active && (
                  <span className="mt-2.5">
                    <Pill>Disabled</Pill>
                  </span>
                )}
                <ArrowRight
                  size={16}
                  style={{ color: "var(--tint)" }}
                  className="absolute right-5 bottom-5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </Page>
    </>
  );
}
