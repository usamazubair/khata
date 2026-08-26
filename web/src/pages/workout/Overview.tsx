import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { fullDate, get, post } from "@/lib/api";
import { riseItem, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { AnimatedNumber, Button, Card, EmptyState, PageHeader, Pill, SectionLabel, StatTile } from "@/components/ui";
import type { WorkoutSummary } from "@/lib/types";

function mondayOf(d: Date) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function CompletionPill({ total, completed }: { total: number; completed: number }) {
  if (total === 0) return <Pill>No exercises</Pill>;
  const done = completed === total;
  return <Pill tone={done ? "good" : completed > 0 ? "warn" : "neutral"}>{completed}/{total} done</Pill>;
}

export default function WorkoutOverview() {
  const [data, setData] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await get<WorkoutSummary>("/api/workouts/summary"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generateThisWeek() {
    setGenerating(true);
    try {
      await post("/api/workout-plans/generate", { week_start: mondayOf(new Date()) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const weekTotal = data?.this_week.reduce((n, s) => n + s.total_exercises, 0) ?? 0;
  const weekDone = data?.this_week.reduce((n, s) => n + s.completed_exercises, 0) ?? 0;
  const fullyDone = data?.this_week.filter((s) => s.total_exercises > 0 && s.completed_exercises === s.total_exercises).length ?? 0;

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Overview">
          <Button onClick={generateThisWeek} disabled={generating}>
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className={generating ? "animate-spin" : ""} /> Generate this week
            </span>
          </Button>
        </PageHeader>

        {error && <EmptyState>{error}</EmptyState>}

        {data && (
          <motion.div variants={staggerParent} initial="hidden" animate="show">
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3.5">
              <StatTile label="Sessions this week" value={<AnimatedNumber value={data.this_week.length} />} />
              <StatTile
                label="Fully completed"
                accent="good"
                value={<AnimatedNumber value={fullyDone} />}
                sub={`of ${data.this_week.length} this week`}
              />
              <StatTile
                label="Exercises done"
                value={<AnimatedNumber value={weekDone} />}
                sub={`of ${weekTotal} planned this week`}
              />
              <StatTile
                label="Total sessions"
                value={<AnimatedNumber value={data.totals.total_sessions} />}
                sub={`${data.totals.active_plans} active plan${data.totals.active_plans === 1 ? "" : "s"}`}
              />
            </div>

            <div className="grid gap-4.5 md:grid-cols-2">
              <Card>
                <SectionLabel>This week</SectionLabel>
                {data.this_week.length === 0 ? (
                  <EmptyState>
                    Nothing scheduled yet —{" "}
                    <Link to="/workout/plans" className="text-accent underline">
                      set up a plan
                    </Link>{" "}
                    or generate this week above.
                  </EmptyState>
                ) : (
                  <motion.div variants={staggerParent} className="mt-1">
                    {data.this_week.map((s, i) => (
                      <motion.div key={s.id} variants={riseItem}>
                        <Link
                          to={`/workout/sessions/${s.id}`}
                          className={`-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-page2 ${
                            i === data.this_week.length - 1 ? "" : "border-b border-rule"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{s.name || "Workout"}</div>
                            <div className="text-[11px] text-muted">{fullDate(s.occurred_on)}</div>
                          </div>
                          <CompletionPill total={s.total_exercises} completed={s.completed_exercises} />
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </Card>

              <Card>
                <SectionLabel>Recent sessions</SectionLabel>
                {data.recent.length === 0 ? (
                  <EmptyState>No sessions yet.</EmptyState>
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
                            <div className="text-[11px] text-muted">{fullDate(s.occurred_on)}</div>
                          </div>
                          <CompletionPill total={s.total_exercises} completed={s.completed_exercises} />
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </div>
          </motion.div>
        )}
      </Page>
    </>
  );
}
