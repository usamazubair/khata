import { useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { ease, spring } from "@/lib/motion";
import { Button, ErrorText, TextInput } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      {/* Two slow-drifting washes give the page depth without distracting. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)", opacity: 0.16 }}
        animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-40 -bottom-40 size-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-2) 0%, transparent 70%)", opacity: 0.16 }}
        animate={{ x: [0, -32, 0], y: [0, -20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        className="relative w-full max-w-sm rounded-3xl border border-rule bg-page/90 p-8 shadow-2xl backdrop-blur-xl"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mb-2 text-center font-mono text-[11px] tracking-[0.09em] text-accent uppercase"
        >
          Khata
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4, ease }}
          className="text-center font-display text-3xl"
        >
          Sign in
        </motion.h1>
        <p className="mt-2 mb-7 text-center text-[13px] text-muted">
          Your expenses and workouts, in one place.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            required
            autoFocus
          />
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />

          {error && <ErrorText>{error}</ErrorText>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
