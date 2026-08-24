import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp } from "lucide-react";
import { get, kg, shortDate } from "@/lib/api";
import { riseItem, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import {
  AnimatedNumber,
  BarRow,
  Card,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
} from "@/components/ui";
import type { WorkoutSummary } from "@/lib/types";

export default function WorkoutOverview() {
  const [data, setData] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<WorkoutSummary>("/api/workouts/summary")
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const maxVolume = data?.top_exercises.length ? Math.max(...data.top_exercises.map((e) => e.volume)) : 1;
  const delta = data ? data.this_week.volume - data.last_week.volume : 0;

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Overview" />

        {error && <EmptyState>{error}</EmptyState>}

        {data && (
          <motion.div variants={staggerParent} initial="hidden" animate="show">
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3.5">
              <StatTile
                label="Sessions this week"
                value={<AnimatedNumber value={data.this_week.sessions} />}
              />
              <StatTile
                label="Volume this week"
                value={<AnimatedNumber value={data.this_week.volume} format={(n) => kg(n)} />}
                sub={
                  data.last_week.volume > 0 ? (
                    <span className={`inline-flex items-center gap-1 ${delta >= 0 ? "text-good" : "text-critical"}`}>
                      {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {kg(Math.abs(delta))} vs last week
                    </span>
                  ) : (
                    "No sessions last week"
                  )
                }
              />
              <StatTile label="Reps this week" value={<AnimatedNumber value={data.this_week.reps} />} />
              <StatTile
                label="Total sessions"
                value={<AnimatedNumber value={data.totals.total_sessions} />}
                sub={`${data.totals.active_exercises} active exercises`}
              />
            </div>

            <div className="grid gap-4.5 md:grid-cols-2">
              <Card>
                <SectionLabel>Volume by exercise — this week</SectionLabel>
                {data.top_exercises.length === 0 ? (
                  <EmptyState>Nothing logged this week yet.</EmptyState>
                ) : (
                  <motion.div variants={staggerParent} className="mt-3 flex flex-col gap-2.5">
                    {data.top_exercises.map((e) => (
                      <BarRow key={e.name} name={e.name} pct={(e.volume / maxVolume) * 100} value={kg(e.volume)} />
                    ))}
                  </motion.div>
                )}
              </Card>

              <Card>
                <SectionLabel>Recent sessions</SectionLabel>
                {data.recent.length === 0 ? (
                  <EmptyState>No sessions yet — start one from the Sessions page.</EmptyState>
                ) : (
                  <motion.div variants={staggerParent} className="mt-1">
                    {data.recent.map((s, i) => (
                      <motion.div key={s.id} variants={riseItem}>
                        <Link
                          to={`/workout/sessions/${s.id}`}
                          className={`-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-page2 ${
                            i === data.recent.length - 1 ? "" : "border-b border-rule"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{s.name || "Workout"}</div>
                            <div className="text-[11px] text-muted">
                              {shortDate(s.occurred_on)} · {s.set_count} set{s.set_count === 1 ? "" : "s"}
                            </div>
                          </div>
                          <span className="num">{kg(s.volume)}</span>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </div>

            <p className="mt-10 text-center text-[12.5px] text-muted">
              Volume is weight moved — reps × weight, summed across every set.
            </p>
          </motion.div>
        )}
      </Page>
    </>
  );
}
