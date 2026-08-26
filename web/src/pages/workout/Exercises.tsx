import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { del, get, post, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveField,
  ActiveToggle,
  Button,
  Dot,
  ErrorText,
  Field,
  FilterChips,
  IconButton,
  PageHeader,
  SearchInput,
  Select,
  TableShell,
  TextArea,
  TextInput,
  cx,
} from "@/components/ui";
import type { Exercise, ExerciseCategory } from "@/lib/types";
import { MediaUpload, type MediaValue } from "@/components/MediaUpload";

export default function Exercises() {
  const [rows, setRows] = useState<Exercise[]>([]);
  const [cats, setCats] = useState<ExerciseCategory[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", category_id: "", equipment: "", notes: "", active: true });
  const [media, setMedia] = useState<MediaValue>({ media_url: null, media_public_id: null, media_type: null });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [exercises, categories] = await Promise.all([
        get<Exercise[]>("/api/exercises"),
        get<ExerciseCategory[]>("/api/exercise-categories?active=true"),
      ]);
      setRows(exercises);
      setCats(categories);
      setForm((f) => ({ ...f, category_id: f.category_id || String(categories[0]?.id ?? "") }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", category_id: String(cats[0]?.id ?? ""), equipment: "", notes: "", active: true });
    setMedia({ media_url: null, media_public_id: null, media_type: null });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name.trim(),
      category_id: Number(form.category_id),
      equipment: form.equipment.trim(),
      notes: form.notes.trim(),
      active: form.active,
      ...media,
    };
    if (!body.name || !body.category_id) return;
    try {
      if (editingId) await put(`/api/exercises/${editingId}`, body);
      else await post("/api/exercises", body);
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const searched = rows.filter((x) =>
    `${x.name} ${x.category_name} ${x.equipment}`.toLowerCase().includes(q.trim().toLowerCase())
  );
  const filtered = searched.filter((x) => categoryFilter === "all" || x.category_id === Number(categoryFilter));
  const chips = [
    { value: "all", label: "All", count: searched.length },
    ...cats.map((c) => ({
      value: String(c.id),
      label: c.name,
      count: searched.filter((x) => x.category_id === c.id).length,
    })),
  ];

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Exercises" />
        <p className="mb-4 text-xs text-muted">
          Your exercise library. Deactivated exercises stay in past sessions but stop being offered for new ones.
        </p>

        <CrudLayout
          toolbar={
            <div className="w-full space-y-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search exercises…" />
              <FilterChips options={chips} value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          }
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Demo</th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">Equipment</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((x) => (
                  <motion.tr
                    key={x.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !x.active && "opacity-55")}
                  >
                    <td className="table-cell">
                      {x.media_url ? (
                        x.media_type === "video" ? (
                          <video src={x.media_url} className="size-11 rounded-lg object-cover" muted loop autoPlay playsInline />
                        ) : (
                          <img src={x.media_url} alt="" className="size-11 rounded-lg object-cover" />
                        )
                      ) : (
                        <span className="flex size-11 items-center justify-center rounded-lg border border-dashed border-rule text-muted">
                          <ImageOff size={14} />
                        </span>
                      )}
                    </td>
                    <td className="table-cell">{x.name}</td>
                    <td className="table-cell text-muted">
                      <span className="flex items-center gap-2">
                        <Dot color={seriesColor(x.category_color)} /> {x.category_name}
                      </span>
                    </td>
                    <td className="table-cell text-muted">{x.equipment || "—"}</td>
                    <td className="table-cell">
                      <ActiveToggle active={x.active} onClick={() => act(() => put(`/api/exercises/${x.id}`, { active: !x.active }))} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          onClick={() => {
                            setEditingId(x.id);
                            setForm({
                              name: x.name,
                              category_id: String(x.category_id),
                              equipment: x.equipment ?? "",
                              notes: x.notes ?? "",
                              active: x.active,
                            });
                            setMedia({
                              media_url: x.media_url,
                              media_public_id: x.media_public_id,
                              media_type: x.media_type,
                            });
                          }}
                        >
                          Edit
                        </IconButton>
                        <IconButton
                          className="hover:text-critical"
                          onClick={() => {
                            if (confirm(`Delete "${x.name}"? This only works if it isn't used by a plan or session.`))
                              act(() => del(`/api/exercises/${x.id}`));
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
                    {rows.length ? "Nothing matches those filters." : "No exercises yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit exercise" : "Add exercise"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>
              {cats.length === 0 && (
                <p className="mb-3 text-xs text-muted">
                  No categories yet —{" "}
                  <Link to="/workout/categories" className="text-accent underline">
                    add one first
                  </Link>
                  .
                </p>
              )}
              <Field label="Name">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bench Press"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Equipment">
                  <TextInput
                    value={form.equipment}
                    onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                    placeholder="Barbell"
                  />
                </Field>
              </div>
              <Field label="Demo photo or clip">
                <MediaUpload value={media} onChange={setMedia} />
              </Field>
              <Field label="Notes">
                <TextArea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Form cues, setup, anything worth remembering"
                />
              </Field>
              <ActiveField
                active={form.active}
                onChange={(v) => setForm({ ...form, active: v })}
                hint="Inactive exercises stay in past sessions but stop being offered for new ones."
              />
              <div className="mt-4 flex gap-2.5">
                <Button type="submit">Save</Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={reset}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          }
        />
      </Page>
    </>
  );
}
