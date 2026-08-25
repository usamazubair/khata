import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Repeat2 } from "lucide-react";
import { get, seriesColor } from "@/lib/api";
import { spring } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { Button, EmptyState, PageHeader, cx } from "@/components/ui";
import {
  WEEKDAYS,
  addDays,
  duration,
  eventsOnDay,
  formatTime,
  fromMinutes,
  hourRange,
  isoDate,
  layoutDay,
  startOfWeek,
  toMinutes,
  weekLabel,
} from "@/lib/timetable";
import type { TimetableEvent } from "@/lib/types";
import { EventComposer, blankDraft, draftFrom, type Draft } from "./EventComposer";

/** Height of one hour of the grid, in pixels. Everything else — block
 *  positions, the now line, where a click lands — is derived from this. */
const HOUR_PX = 60;
/** Clicks snap to this, so dragging precision isn't required to get 09:30. */
const SNAP_MINUTES = 15;

export default function Week() {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await get<TimetableEvent[]>("/api/timetable?active=true"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The "now" line only needs to be roughly right; a minute's granularity is
  // plenty and costs one render.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { from, to } = useMemo(() => hourRange(events), [events]);
  const hours = useMemo(() => Array.from({ length: to - from }, (_, i) => from + i), [from, to]);
  const gridHeight = (to - from) * HOUR_PX;

  const days = useMemo(
    () => WEEKDAYS.map((d, i) => ({ ...d, date: addDays(monday, i), iso: isoDate(addDays(monday, i)) })),
    [monday]
  );

  const todayIso = isoDate(now);
  const nowOffset = ((now.getHours() * 60 + now.getMinutes()) / 60 - from) * HOUR_PX;
  const nowVisible = nowOffset >= 0 && nowOffset <= gridHeight;

  // Open on the working day rather than at midnight.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (8 - from) * HOUR_PX - 20);
  }, [from]);

  /** Turn a click in a day column into a start time, snapped. */
  function timeAt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = from * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60;
    return fromMinutes(Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES);
  }

  function addAt(day: (typeof days)[number], e: React.MouseEvent<HTMLDivElement>) {
    const start = timeAt(e);
    const next = blankDraft(day.date, day.dow, Number(start.slice(0, 2)));
    setDraft({
      ...next,
      starts_at: start,
      ends_at: fromMinutes(Math.min(toMinutes(start) + 60, 24 * 60 - 1)),
    });
  }

  return (
    <>
      <Navbar module="timetable" />
      <Page wide>
        <PageHeader eyebrow="Timetable" title="Your week">
          <Button onClick={() => setDraft(blankDraft(new Date(), new Date().getDay(), 9))}>
            <span className="flex items-center gap-1.5">
              <CalendarPlus size={15} /> New entry
            </span>
          </Button>
        </PageHeader>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-rule bg-page p-1">
            <button
              onClick={() => setMonday(addDays(monday, -7))}
              className="cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-page2 hover:text-ink"
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMonday(startOfWeek(new Date()))}
              className="cursor-pointer rounded-full px-3 py-1 text-[12.5px] text-muted transition-colors hover:text-ink"
            >
              Today
            </button>
            <button
              onClick={() => setMonday(addDays(monday, 7))}
              className="cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-page2 hover:text-ink"
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="num text-[13px] text-muted">{weekLabel(monday)}</span>
          <span className="ml-auto text-[11.5px] text-muted">Click any empty slot to add · click an entry to edit</span>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        <div className="surface overflow-hidden">
          {/* Day headings stay put while the hours scroll under them. */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-rule bg-page2/50">
            <div />
            {days.map((d) => {
              const isToday = d.iso === todayIso;
              return (
                <div key={d.dow} className="px-1 py-2.5 text-center">
                  <div className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{d.short}</div>
                  <div
                    className={cx(
                      "num mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-[13px]",
                      isToday ? "bg-accent font-semibold text-accent-ink" : "text-ink"
                    )}
                  >
                    {d.date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div ref={scroller} className="max-h-[62vh] overflow-y-auto">
            <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: gridHeight }}>
              {/* hour gutter */}
              <div className="relative border-r border-rule">
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-muted"
                    style={{ top: i * HOUR_PX }}
                  >
                    {i === 0 ? "" : formatTime(`${String(h).padStart(2, "0")}:00`)}
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const laid = layoutDay(eventsOnDay(events, d.dow, d.iso));
                return (
                  <div
                    key={d.dow}
                    onClick={(e) => addAt(d, e)}
                    className={cx(
                      "relative cursor-copy border-r border-rule last:border-r-0",
                      d.iso === todayIso && "bg-accent/[0.04]"
                    )}
                  >
                    {hours.map((h, i) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute inset-x-0 border-t border-rule/60"
                        style={{ top: i * HOUR_PX }}
                      />
                    ))}

                    <AnimatePresence initial={false}>
                      {laid.map(({ item, col, cols }) => {
                        const top = (toMinutes(item.starts_at) / 60 - from) * HOUR_PX;
                        const height = ((toMinutes(item.ends_at) - toMinutes(item.starts_at)) / 60) * HOUR_PX;
                        const tint = seriesColor(item.color);
                        // Below ~34px there's only room for one line, so the
                        // time is dropped rather than clipped mid-word.
                        const roomy = height >= 46;
                        return (
                          <motion.button
                            key={`${item.id}-${d.iso}`}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={spring}
                            whileHover={{ y: -1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraft(draftFrom(item, d.iso));
                            }}
                            title={`${item.title} · ${formatTime(item.starts_at)}–${formatTime(item.ends_at)}`}
                            className="absolute cursor-pointer overflow-hidden rounded-lg px-2 py-1 text-left"
                            style={{
                              top: top + 1,
                              height: Math.max(height - 2, 20),
                              left: `calc(${(col / cols) * 100}% + 2px)`,
                              width: `calc(${100 / cols}% - 4px)`,
                              backgroundColor: `color-mix(in oklab, ${tint} 18%, var(--page))`,
                              borderLeft: `3px solid ${tint}`,
                              color: "var(--ink)",
                            }}
                          >
                            <div className="truncate text-[11.5px] font-semibold leading-tight">{item.title}</div>
                            {roomy && (
                              <div className="num truncate text-[10px] text-muted">
                                {formatTime(item.starts_at)} · {duration(item.starts_at, item.ends_at)}
                              </div>
                            )}
                            {roomy && item.location && (
                              <div className="flex items-center gap-1 truncate text-[10px] text-muted">
                                <MapPin size={9} /> {item.location}
                              </div>
                            )}
                            {!item.event_date && height >= 70 && (
                              <Repeat2 size={10} className="absolute right-1.5 bottom-1.5 text-muted" />
                            )}
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>

                    {d.iso === todayIso && nowVisible && (
                      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowOffset }}>
                        <div className="relative h-px bg-critical">
                          <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-critical" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {events.length === 0 && !error && (
          <p className="mt-4 text-[13px] text-muted">
            Nothing on the timetable yet — click a slot above, or use <strong className="text-ink">New entry</strong>.
          </p>
        )}

        <EventComposer draft={draft} onClose={() => setDraft(null)} onSaved={load} />
      </Page>
    </>
  );
}
