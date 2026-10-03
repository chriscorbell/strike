import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { useApplyState, useProfile, useWeights } from "../../lib/queries.ts";
import { draftFromProfile } from "./model.ts";
import { Wizard } from "./Wizard.tsx";

/** Edit profile: the onboarding wizard, opened on its overview, prefilled and saved with PUT /api/profile. */
export function EditProfilePage() {
  const profile = useProfile();
  const weights = useWeights();
  const navigate = useNavigate();
  const applyState = useApplyState();
  const [base] = useState(profile);
  const [initialDraft] = useState(() => draftFromProfile(profile));

  const save = useMutation({
    mutationFn: endpoints.updateProfile,
    onSuccess: (state) => {
      applyState(state);
      toast("Profile saved");
      navigate("/settings");
    },
  });

  return (
    <Wizard
      mode="edit"
      initialDraft={initialDraft}
      initialStep="review"
      base={base}
      currentWeightKg={weights.data?.latestTrendKg ?? null}
      submitting={save.isPending}
      onSubmit={(payload) => {
        if (payload.mode === "edit") save.mutate(payload.profile);
      }}
      onExit={() => navigate("/settings")}
    />
  );
}
