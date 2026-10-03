import type { StateResponse } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { endpoints } from "../../lib/endpoints.ts";
import { keys, useApplyState } from "../../lib/queries.ts";
import { BuildingScreen } from "./BuildingScreen.tsx";
import { defaultDraft } from "./model.ts";
import { clearProgress, loadProgress, saveProgress } from "./persist.ts";
import { Wizard } from "./Wizard.tsx";

/** First run: the wizard, then a short wait while the coach builds the plan. */
export function OnboardingFlow() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const applyState = useApplyState();
  const [saved] = useState(loadProgress);
  // Held locally: putting it in the ["state"] query switches the app to the main shell immediately.
  const [built, setBuilt] = useState<StateResponse | null>(null);

  const onboard = useMutation({
    mutationFn: endpoints.onboard,
    onSuccess: (state) => {
      clearProgress();
      qc.removeQueries({ queryKey: keys.pendingJobs });
      window.scrollTo({ top: 0 });
      setBuilt(state);
    },
  });

  if (built) {
    return (
      <BuildingScreen
        state={built}
        onContinue={() => {
          navigate("/", { replace: true });
          applyState(built);
        }}
      />
    );
  }

  return (
    <Wizard
      mode="new"
      initialDraft={saved?.draft ?? defaultDraft()}
      initialStep={saved?.step}
      initialFurthest={saved?.furthest}
      submitting={onboard.isPending}
      onSubmit={(payload) => {
        if (payload.mode === "new") onboard.mutate(payload.request);
      }}
      onProgress={saveProgress}
    />
  );
}
