import SwiftUI

/// The full-screen session: start check, exercises with set logging, rest timer, feedback, finish.
struct WorkoutView: View {
    @Bindable var store: WorkoutStore
    @Environment(AppModel.self) private var app

    @State private var swapTarget: SessionExercise?
    @State private var confirmFinish = false
    @State private var confirmFinishBottom = false
    @State private var confirmSkip = false

    var body: some View {
        NavigationStack {
            Group {
                if let completion = store.completion {
                    WorkoutSummaryView(response: completion, loadUnit: store.loadUnit) {
                        app.closeWorkout()
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
                } else if let session = store.session {
                    if session.status == .planned {
                        WorkoutStartView(store: store, session: session)
                    } else {
                        sessionContent(session)
                    }
                } else if let error = store.loadError {
                    LoadErrorView(message: error) { await store.load() }
                } else {
                    ProgressView()
                        .controlSize(.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .background(Theme.screenBackground)
            .toolbar { toolbar }
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(item: $store.feedbackMuscle) { muscle in
            MuscleFeedbackSheet(store: store, muscle: muscle)
        }
        .sheet(item: $swapTarget) { exercise in
            SwapExerciseSheet(store: store, exercise: exercise)
        }
        .confirmationDialog("Skip this session?", isPresented: $confirmSkip, titleVisibility: .visible) {
            Button("Skip session", role: .destructive) {
                Task {
                    if await store.skip() { app.closeWorkout() }
                }
            }
        } message: {
            Text("The next session moves up to your next training day.")
        }
        .sensoryFeedback(.success, trigger: store.loggedTick)
        .sensoryFeedback(.impact(weight: .heavy, intensity: 1), trigger: store.restEndedTick)
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if store.completion == nil {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    app.isWorkoutPresented = false
                } label: {
                    Image(systemName: "chevron.down")
                }
                .accessibilityLabel("Minimize workout")
            }
        }
        ToolbarItem(placement: .principal) {
            if let session = store.session, store.completion == nil, session.status != .planned {
                VStack(spacing: 0) {
                    Text(session.label)
                        .font(.headline)
                    Text(subtitle(session))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
        if let session = store.session, store.completion == nil {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Location", selection: locationBinding(session)) {
                        ForEach(Location.allCases) { location in
                            Label(location.displayName, systemImage: location.symbol).tag(location)
                        }
                    }
                    if session.status != .completed {
                        Divider()
                        Button("Skip session", systemImage: "forward.end", role: .destructive) {
                            confirmSkip = true
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .accessibilityLabel("Workout options")
            }
            if session.status == .inProgress {
                ToolbarSpacer(.fixed, placement: .topBarTrailing)
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if store.progress.done < store.progress.total {
                            confirmFinish = true
                        } else {
                            Task { await store.complete() }
                        }
                    } label: {
                        if store.isWorking {
                            ProgressView()
                        } else {
                            Text("Finish")
                                .fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(.glassProminent)
                    .disabled(store.isWorking || store.progress.done == 0)
                    .modifier(FinishConfirmation(isPresented: $confirmFinish, prompt: finishPrompt) {
                        Task { await store.complete() }
                    })
                }
            }
        }
    }

    private var finishPrompt: String {
        let left = store.progress.total - store.progress.done
        return left == 1 ? "1 set isn't logged. Finish anyway?" : "\(left) sets aren't logged. Finish anyway?"
    }

    private func subtitle(_ session: Session) -> String {
        var parts = [store.weekLabel, "\(session.targetRir) RIR"]
        parts.append(session.location.displayName)
        return parts.joined(separator: " · ")
    }

    private func locationBinding(_ session: Session) -> Binding<Location> {
        Binding {
            session.location
        } set: { location in
            Task { await store.changeLocation(location) }
        }
    }

    // MARK: Session

    private func sessionContent(_ session: Session) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 16) {
                    WorkoutHeader(store: store, session: session)
                    ForEach(store.orderedExercises) { exercise in
                        ExerciseCard(store: store, exercise: exercise) {
                            swapTarget = exercise
                        }
                        .id("exercise-\(exercise.id)")
                    }
                    if session.status == .inProgress {
                        finishButton
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: store.focused) { _, focused in
                guard let focused else { return }
                withAnimation(Theme.spring) {
                    proxy.scrollTo(SetRowID(key: focused), anchor: .center)
                }
            }
            .onAppear {
                if let focused = store.focused {
                    proxy.scrollTo(SetRowID(key: focused), anchor: .center)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let rest = store.rest {
                RestTimerBar(rest: rest, store: store)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(Theme.spring, value: store.rest)
    }

    private var finishButton: some View {
        Button {
            if store.progress.done < store.progress.total {
                confirmFinishBottom = true
            } else {
                Task { await store.complete() }
            }
        } label: {
            Label("Finish workout", systemImage: "flag.checkered")
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 40)
        }
        .buttonStyle(.glass)
        .controlSize(.large)
        .disabled(store.isWorking || store.progress.done == 0)
        .modifier(FinishConfirmation(isPresented: $confirmFinishBottom, prompt: finishPrompt) {
            Task { await store.complete() }
        })
        .padding(.top, 8)
    }
}

/// "Finish anyway?" anchored to the button that asked.
private struct FinishConfirmation: ViewModifier {
    @Binding var isPresented: Bool
    var prompt: String
    var onConfirm: () -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(prompt, isPresented: $isPresented, titleVisibility: .visible) {
            Button("Finish workout", action: onConfirm)
            Button("Keep going", role: .cancel) {}
        }
    }
}

/// Stable scroll id for a set row.
struct SetRowID: Hashable {
    var key: WorkoutStore.SetKey
}

/// Progress, elapsed time and location for a session in progress.
private struct WorkoutHeader: View {
    var store: WorkoutStore
    var session: Session

    var body: some View {
        let progress = store.progress
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sets")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text("\(progress.done)")
                            .font(.number(.title, weight: .bold))
                            .contentTransition(.numericText(value: Double(progress.done)))
                        Text("/\(progress.total)")
                            .font(.number(.title3, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let started = store.startedAt, session.status == .inProgress {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Elapsed")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(started, style: .timer)
                            .font(.number(.title3, weight: .semibold))
                    }
                } else if session.status == .completed {
                    Tag(text: "Completed", systemImage: "checkmark", tint: .green)
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.accentColor.opacity(0.18))
                    Capsule().fill(Color.accentColor)
                        .frame(width: progress.total > 0 ? geo.size.width * Double(progress.done) / Double(progress.total) : 0)
                }
            }
            .frame(height: 6)
            .animation(Theme.spring, value: progress.done)
            if session.isDeload {
                Label("Deload week: lighter loads, fewer sets. Leave plenty in the tank.", systemImage: "leaf")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .card()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(progress.done) of \(progress.total) sets logged")
    }
}
