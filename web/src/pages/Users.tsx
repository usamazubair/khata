import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { del, get, post, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rowItem, spring } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveToggle,
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Pill,
  SearchInput,
  TableShell,
  TextInput,
  cx,
} from "@/components/ui";
import type { Module, Role, User } from "@/lib/types";

const ROLES: Role[] = ["member", "admin"];

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" as Role });
  const [moduleIds, setModuleIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [users, mods] = await Promise.all([get<User[]>("/api/users"), get<Module[]>("/api/modules")]);
      setRows(users);
      setModules(mods);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", email: "", password: "", role: "member" });
    setModuleIds([]);
    setError(null);
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setForm({ name: u.name ?? "", email: u.email, password: "", role: u.role });
    setModuleIds(u.module_ids ?? []);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editingId && !form.password) {
      setError("A password is required for a new user.");
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      module_ids: form.role === "admin" ? [] : moduleIds,
    };
    if (form.password) body.password = form.password;
    try {
      if (editingId) await put(`/api/users/${editingId}`, body);
      else await post("/api/users", body);
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

  const filtered = rows.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <Navbar admin />
      <Page>
        <PageHeader eyebrow="Settings" title="Users" />
        <p className="mb-4 text-xs text-muted">
          Members only reach the modules you tick — the API refuses the rest, not just the card. Admins always see everything.
        </p>

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search users…" />}
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Email</th>
                  <th className="table-head">Role</th>
                  <th className="table-head">Modules</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((u) => {
                  const isSelf = u.id === me?.id;
                  const moduleNames =
                    u.role === "admin"
                      ? "All (admin)"
                      : u.module_ids?.length
                        ? u.module_ids.map((id) => modules.find((m) => m.id === id)?.name ?? "?").join(", ")
                        : "—";
                  return (
                    <motion.tr
                      key={u.id}
                      variants={rowItem}
                      exit="exit"
                      layout
                      className={cx("border-b border-rule last:border-0", !u.active && "opacity-55")}
                    >
                      <td className="table-cell">
                        <span className="flex items-center gap-2">
                          {u.name || "—"}
                          {isSelf && <Pill>you</Pill>}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-[11px] text-muted">{u.email}</td>
                      <td className="table-cell text-muted">{u.role}</td>
                      <td className="table-cell text-muted">{moduleNames}</td>
                      <td className="table-cell">
                        {isSelf ? (
                          <Pill tone="good">Active</Pill>
                        ) : (
                          <ActiveToggle active={u.active} onClick={() => act(() => put(`/api/users/${u.id}`, { active: !u.active }))} />
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-end gap-1">
                          <IconButton onClick={() => startEdit(u)}>Edit</IconButton>
                          {!isSelf && (
                            <IconButton
                              className="hover:text-critical"
                              onClick={() => {
                                if (confirm(`Delete ${u.email}? They lose access immediately.`))
                                  act(() => del(`/api/users/${u.id}`));
                              }}
                            >
                              Delete
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-muted">
                    {rows.length ? "Nothing matches your search." : "No users yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit user" : "Add user"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>

              <Field label="Name">
                <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Their name" />
              </Field>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="them@example.com"
                  required
                />
              </Field>
              <Field
                label="Password"
                hint={editingId ? "Leave blank to keep their current password." : "At least 8 characters."}
              >
                <TextInput
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>

              <Field label="Role">
                <div className="flex gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={cx(
                        "relative flex-1 cursor-pointer rounded-lg border px-3 py-2 text-xs transition-colors",
                        form.role === r ? "border-accent text-ink" : "border-rule text-muted hover:text-ink"
                      )}
                    >
                      {form.role === r && (
                        <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-page2" transition={spring} />
                      )}
                      <span className="relative">{r}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Module access">
                <AnimatePresence mode="wait" initial={false}>
                  {form.role === "admin" ? (
                    <motion.p
                      key="admin"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-muted"
                    >
                      Admins can see every module automatically.
                    </motion.p>
                  ) : (
                    <motion.div
                      key="member"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-2 overflow-hidden"
                    >
                      {modules.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                          <input
                            type="checkbox"
                            checked={moduleIds.includes(m.id)}
                            onChange={(e) =>
                              setModuleIds((prev) =>
                                e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)
                              )
                            }
                            className="size-4 cursor-pointer accent-[var(--accent)]"
                          />
                          <span>
                            {m.icon} {m.name}
                          </span>
                        </label>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Field>

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
