import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CalendarPlus } from "lucide-react";
import { del, get, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import {
  ActiveToggle,
  Button,
  Dot,
  EmptyState,
  FilterChips,
  IconButton,
  PageHeader,
  Pill,
  SearchInput,
  TableShell,
  cx,
} from "@/components/ui";
import { REMINDER_OPTIONS, WEEKDAYS, duration, formatTime, isoDate } from "@/lib/timetable";
import type { TimetableEvent } from "@/lib/types";
import { EventComposer, blankDraft, draftFrom, type Draft } from "./EventComposer";

const KINDS = [
  { value: "all", label: "All" },
  { value: "weekly", label: "Repeating" },
  { value: "once", label: "One-off" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

const dayName = (dow: number) => WEEKDAYS.find((d) => d.dow === dow)?.long ?? "";
const reminderLabel = (m: number | null) =>
  m === null ? null : REMINDER_OPTIONS.find((o) => o.value === String(m))?.label ?? `${m} min before`;

export default function AllEvents() {
  const [rows, setRows] = useState<TimetableEvent[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await get<TimetableEvent[]>("/api/timetable"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const searched = rows.filter((e) =>
    `${e.title} ${e.location} ${e.notes}`.toLowerCase().includes(q.trim().toLowerCase())
  );
  const matchesKind = (e: TimetableEvent, k: Kind) =>
    k === "all" || (k === "weekly" ? !e.event_date : !!e.event_date);
  const filtered = searched.filter((e) => matchesKind(e, kind));
  const chips = KINDS.map((k) => ({ ...k, count: searched.filter((e) => matchesKind(e, k.value)).length }));

  return (
    <>
      <Navbar module="timetable" />
      <Page>
        <PageHeader eyebrow="Timetable" title="All entries">
          <Button onClick={() => setDraft(blankDraft(new Date(), new Date().getDay(), 9))}>
            <span className="flex items-center gap-1.5">
              <CalendarPlus size={15} /> New entry
            </span>
          </Button>
        </PageHeader>

        <div className="mb-4 space-y-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search the timetable…" />
          <FilterChips options={chips} value={kind} onChange={setKind} />
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        <TableShell
          head={
            <>
              <th className="table-head">Entry</th>
              <th className="table-head">When</th>
              <th className="table-head">Time</th>
              <th className="table-head">Reminder</th>
              <th className="table-head">Status</th>
              <th className="table-head" />
            </>
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((e) => (
              <motion.tr
                key={e.id}
                variants={rowItem}
                exit="exit"
                layout
                className={cx("border-b border-rule last:border-0", !e.active && "opacity-55")}
              >
                <td className="table-cell">
                  <span className="flex items-center gap-2.5">
                    <Dot color={seriesColor(e.color)} />
                    <span>
                      {e.title}
                      {e.location && <span className="ml-2 text-[11.5px] text-muted">{e.location}</span>}
                    </span>
                  </span>
                </td>
                <td className="table-cell whitespace-nowrap">
                  {e.event_date ? (
                    <Pill>
                      {new Date(`${e.event_date}T00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Pill>
                  ) : (
                    <Pill tone="accent">Every {dayName(e.day_of_week)}</Pill>
                  )}
                </td>
                <td className="table-cell num whitespace-nowrap">
                  {formatTime(e.starts_at)} – {formatTime(e.ends_at)}
                  <span className="ml-2 text-[11px] text-muted">{duration(e.starts_at, e.ends_at)}</span>
                </td>
                <td className="table-cell whitespace-nowrap text-muted">
                  {e.remind_minutes === null ? (
                    "—"
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Bell size={12} className="text-accent" /> {reminderLabel(e.remind_minutes)}
                    </span>
                  )}
                </td>
                <td className="table-cell">
                  <ActiveToggle
                    active={e.active}
                    onClick={() => act(() => put(`/api/timetable/${e.id}`, { active: !e.active }))}
                  />
                </td>
                <td className="table-cell">
                  <div className="flex justify-end gap-1">
                    <IconButton onClick={() => setDraft(draftFrom(e, isoDate(new Date())))}>Edit</IconButton>
                    <IconButton
                      className="hover:text-critical"
                      onClick={() => {
                        if (confirm(`Delete "${e.title}"?`)) act(() => del(`/api/timetable/${e.id}`));
                      }}
                    >
                      Delete
                    </IconButton>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="table-cell text-muted">
                {rows.length ? "Nothing matches those filters." : "Nothing on the timetable yet."}
              </td>
            </tr>
          )}
        </TableShell>

        <p className="mt-3 text-xs text-muted">
          Deactivated entries stay here but disappear from the week grid and stop reminding you.
        </p>

        <EventComposer draft={draft} onClose={() => setDraft(null)} onSaved={load} />
      </Page>
    </>
  );
}
