import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, KeyRound } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Wordmark } from "../../components/AppShell.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextInput } from "../../components/ui/Field.tsx";
import { errorMessage, isUnauthorized, setToken } from "../../lib/api.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { easeOut } from "../../lib/motion.ts";
import { keys } from "../../lib/queries.ts";

export function ConnectScreen({ onConnected, rejected }: { onConnected: () => void; rejected?: boolean }) {
  const qc = useQueryClient();
  const [token, setDraft] = useState("");
  const [error, setError] = useState<string | null>(rejected ? "The saved token no longer works. Enter it again." : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    setToken(t);
    try {
      const state = await endpoints.state();
      qc.setQueryData(keys.state, state);
      onConnected();
    } catch (err) {
      setToken(null);
      setError(isUnauthorized(err) ? "That token didn't work." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={easeOut}
        className="mx-auto w-full max-w-sm"
      >
        <Wordmark />
        <h1 className="mt-10 text-[28px] font-semibold leading-tight tracking-tight">Connect to your server</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-3">
          Enter the access token set as <code className="font-mono text-[13px] text-ink-2">STRIKE_TOKEN</code> on the server.
        </p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <Field label="Access token" error={error}>
            <TextInput
              type="password"
              autoComplete="current-password"
              autoFocus
              value={token}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!token.trim()} iconRight={ArrowRight}>
            Connect
          </Button>
        </form>
        <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-3">
          <KeyRound size={14} aria-hidden />
          Stored on this device only.
        </p>
      </motion.div>
    </main>
  );
}
