import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell, Wordmark } from "./components/AppShell.tsx";
import { ErrorState, Skeleton } from "./components/ui/States.tsx";
import { Toaster, toastError } from "./components/ui/Toast.tsx";
import { ConnectScreen } from "./features/connect/ConnectScreen.tsx";
import { CookModePage } from "./features/meals/CookMode.tsx";
import { MealsPage } from "./features/meals/MealsPage.tsx";
import { PlanPage } from "./features/plan/PlanPage.tsx";
import { SettingsPage } from "./features/settings/SettingsPage.tsx";
import { TodayPage } from "./features/today/TodayPage.tsx";
import { SessionPage } from "./features/workout/SessionPage.tsx";
import { ApiError, errorMessage, getToken, isUnauthorized, onUnauthorized, setToken } from "./lib/api.ts";
import { useAppState } from "./lib/queries.ts";

const ProgressPage = lazy(() => import("./features/progress/ProgressPage.tsx").then((m) => ({ default: m.ProgressPage })));
const OnboardingFlow = lazy(() => import("./features/onboarding/OnboardingFlow.tsx").then((m) => ({ default: m.OnboardingFlow })));
const EditProfilePage = lazy(() =>
  import("./features/onboarding/EditProfilePage.tsx").then((m) => ({ default: m.EditProfilePage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return count < 2;
      },
    },
  },
  queryCache: new QueryCache(),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent || isUnauthorized(error)) return;
      toastError(errorMessage(error));
    },
  }),
});

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Root />
          <Toaster />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}

function Root() {
  const qc = useQueryClient();
  const [locked, setLocked] = useState(false);
  const [rejected, setRejected] = useState(false);
  const state = useAppState();

  useEffect(
    () =>
      onUnauthorized(() => {
        if (getToken()) setRejected(true);
        setToken(null);
        setLocked(true);
      }),
    [],
  );

  if (locked || isUnauthorized(state.error)) {
    return (
      <ConnectScreen
        rejected={rejected}
        onConnected={() => {
          setLocked(false);
          setRejected(false);
          void qc.resetQueries();
        }}
      />
    );
  }

  if (state.isPending) return <Splash />;

  if (state.isError) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-5">
        <Wordmark />
        <ErrorState error={state.error} onRetry={() => void state.refetch()} className="mt-6" />
      </main>
    );
  }

  if (!state.data.onboarded || !state.data.profile) {
    return (
      <Suspense fallback={<Splash />}>
        <OnboardingFlow />
      </Suspense>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/meals/prep/:menuId/:session" element={<CookModePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<EditProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function Splash() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center" aria-busy="true">
      <Wordmark className="animate-shimmer" />
    </main>
  );
}

function RouteFallback() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-8 h-56" />
    </div>
  );
}

