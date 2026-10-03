import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import { Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextArea } from "../../components/ui/Field.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";

/** A free-form note the coach reads the next time it writes anything. */
export function CoachNote({ className }: { className?: string }) {
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: (n: string) => endpoints.coachNote(n),
    onSuccess: () => {
      toast("Sent to your coach");
      setNote("");
    },
  });
  const text = note.trim();

  return (
    <Section title="Note to coach" description="Read the next time your coach writes your block, menu or check-in." className={className}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (text) send.mutate(text);
        }}
      >
        <Field label="Note to coach" hideLabel>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Traveling next week, left knee is sore"
          />
        </Field>
        <div className="mt-3 flex justify-end">
          <Button type="submit" icon={Send} disabled={!text} loading={send.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Section>
  );
}
