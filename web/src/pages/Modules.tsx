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

// Slug -> the client route its card opens.
const ROUTES: Record<string, string> = { transactions: "/transactions", workout: "/workout" };

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
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-page p-6 transition-colors hover:border-accent"
              >
                {/* A wash that only appears on hover, so the card feels alive. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "radial-gradient(120% 90% at 0% 0%, var(--accent) 0%, transparent 55%)", mixBlendMode: "soft-light" }}
                />
                <motion.span
                  className="mb-3 text-3xl leading-none"
                  whileHover={{ scale: 1.12, rotate: -6 }}
                  transition={spring}
                >
                  {m.icon}
                </motion.span>
                <span className="font-display text-lg font-semibold">{m.name}</span>
                <span className="mt-1 text-[12.5px] text-muted">{m.description}</span>
                {!m.active && (
                  <span className="mt-2.5">
                    <Pill>Disabled</Pill>
                  </span>
                )}
                <ArrowRight
                  size={16}
                  className="absolute right-5 bottom-5 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </Page>
    </>
  );
}
