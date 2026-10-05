import { ArrowUp, LoaderCircle } from "lucide-react";
import { useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { cn } from "../../lib/cn.ts";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** The coach is answering: typing is fine, sending waits. */
  busy: boolean;
  /** The message is on its way. */
  sending: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

/** Message field that grows with its text. Enter sends, Shift+Enter starts a new line. */
export function Composer({ value, onChange, onSend, busy, sending, inputRef }: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy && !sending;

  // Grow with the text up to the max height, then scroll inside.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (canSend) onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-1.5 pl-4 transition-colors duration-150 focus-within:border-accent/60"
    >
      <label htmlFor="coach-message" className="sr-only">
        Message
      </label>
      <textarea
        id="coach-message"
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={4000}
        enterKeyHint="send"
        placeholder="Message your coach"
        className="max-h-44 min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-6 text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        title={busy ? "The coach is still answering" : "Send"}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:active:scale-100",
          canSend || sending ? "bg-accent text-accent-ink hover:brightness-105" : "bg-raised text-ink-3",
        )}
      >
        {sending ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <ArrowUp size={19} strokeWidth={2.25} aria-hidden />}
      </button>
    </form>
  );
}
