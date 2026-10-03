import SwiftUI
import UserNotifications

/// Shown right after onboarding while the coach writes the first training block and menu. Polls
/// the pending jobs, offers reminders and Apple Health meanwhile, and moves on once both are done.
struct PlanBuildingView: View {
    @Environment(AppModel.self) private var app

    /// Every job seen, by id, with the latest known status.
    @State private var jobs: [Int: Job] = [:]
    @State private var loaded = false
    @State private var reminders: PermissionState = .unknown
    @State private var health: PermissionState = .unknown
    @State private var requesting = false
    @State private var appearedAt = Date.now

    private enum PermissionState { case unknown, available, granted, denied }

    /// Onboarding always queues these two; any other job seen is listed after them.
    private static let expected: [JobKind] = [.mesocycle, .mealMenu]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                header
                jobList
                actions
            }
            .padding(.horizontal, 20)
            .padding(.top, 40)
            .padding(.bottom, 24)
        }
        .background(Theme.screenBackground)
        .safeAreaBar(edge: .bottom) {
            Button {
                app.finishBuilding()
            } label: {
                Text("Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
        }
        .task { await poll() }
        .task { await loadPermissionStates() }
        .task(id: AutoContinue(done: allDone, busy: requesting)) { await autoContinue() }
        .sensoryFeedback(.success, trigger: allDone) { old, new in !old && new }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            StrikeMark(size: 56)
            VStack(alignment: .leading, spacing: 6) {
                Text(allDone ? "Your plan is ready" : "Building your plan")
                    .font(.largeTitle.weight(.bold))
                    .contentTransition(.opacity)
                    .accessibilityAddTraits(.isHeader)
                Text(app.coachAvailable
                    ? "Your coach is writing your first training block and this week's menu."
                    : "Using the built-in planner, so this is quick.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
        .animation(Theme.spring, value: allDone)
    }

    // MARK: Jobs

    private struct Row: Identifiable {
        enum Status: Equatable { case waiting, running, done, failed }

        var kind: JobKind
        var status: Status
        var id: String { kind.rawValue }
    }

    private var rows: [Row] {
        let seenKinds = jobs.values.sorted { $0.id < $1.id }.map(\.kind)
        var kinds = Self.expected
        for kind in seenKinds where !kinds.contains(kind) { kinds.append(kind) }
        return kinds.map { kind in
            guard let job = jobs.values.filter({ $0.kind == kind }).max(by: { $0.id < $1.id }) else {
                // Not pending when we first looked: already finished, or still loading.
                return Row(kind: kind, status: loaded ? .done : .running)
            }
            let status: Row.Status = switch job.status {
            case .queued: .waiting
            case .running: .running
            case .succeeded: .done
            case .failed: .failed
            }
            return Row(kind: kind, status: status)
        }
    }

    private var allDone: Bool {
        loaded && jobs.values.allSatisfy(\.status.isFinished)
    }

    private var jobList: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 {
                    Divider().padding(.leading, 44)
                }
                jobRow(row)
            }
        }
        .padding(.horizontal, Theme.padding)
        .padding(.vertical, 4)
        .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        .animation(Theme.spring, value: rows.map(\.status))
    }

    private func jobRow(_ row: Row) -> some View {
        HStack(spacing: 14) {
            ZStack {
                switch row.status {
                case .waiting:
                    Image(systemName: "circle.dotted")
                        .foregroundStyle(.secondary)
                        .transition(.opacity)
                case .running:
                    ProgressView()
                        .transition(.opacity)
                case .done:
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.success)
                        .transition(.scale.combined(with: .opacity))
                case .failed:
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Theme.warning)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .font(.title3)
            .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(title(row.kind))
                    .font(.body.weight(.semibold))
                Text(detail(row))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .contentTransition(.opacity)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }

    private func title(_ kind: JobKind) -> String {
        switch kind {
        case .mesocycle: "Training block"
        case .mealMenu: "This week's menu"
        default: kind.activity
        }
    }

    private func detail(_ row: Row) -> String {
        switch row.status {
        case .waiting: "Up next"
        case .running: row.kind.activity
        case .done: "Ready"
        case .failed: "Didn't finish. You can rebuild it later."
        }
    }

    // MARK: While you wait

    @ViewBuilder
    private var actions: some View {
        let showHealth = app.healthKit.isAvailable
        VStack(alignment: .leading, spacing: 12) {
            Text(allDone ? "Before you start" : "While you wait")
                .font(.title3.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
                .padding(.horizontal, 4)
            VStack(spacing: 0) {
                actionRow(
                    title: "Reminders",
                    detail: remindersDetail,
                    symbol: "bell.badge.fill",
                    tint: .red,
                    state: reminders,
                    button: "Allow",
                    action: allowReminders
                )
                if showHealth {
                    Divider().padding(.leading, 52)
                    actionRow(
                        title: "Apple Health",
                        detail: healthDetail,
                        symbol: "heart.fill",
                        tint: .pink,
                        state: health,
                        button: "Connect",
                        action: connectHealth
                    )
                }
            }
            .padding(.horizontal, Theme.padding)
            .padding(.vertical, 4)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    private var remindersDetail: String {
        switch reminders {
        case .granted: "On for meals and workouts"
        case .denied: "Turned off in iOS Settings"
        default: "Meal times and workouts"
        }
    }

    private var healthDetail: String {
        health == .granted ? "Connected" : "Keeps your weight trend current"
    }

    private func actionRow(
        title: String,
        detail: String,
        symbol: String,
        tint: Color,
        state: PermissionState,
        button: String,
        action: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(tint, in: .rect(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .contentTransition(.opacity)
            }
            Spacer(minLength: 8)
            switch state {
            case .granted:
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.success)
                    .transition(.scale.combined(with: .opacity))
                    .accessibilityLabel("On")
            case .denied:
                EmptyView()
            case .unknown, .available:
                Button(button, action: action)
                    .buttonStyle(.glass)
                    .controlSize(.small)
                    .disabled(requesting || state == .unknown)
                    .transition(.opacity)
                    .accessibilityLabel("\(button) \(title)")
            }
        }
        .padding(.vertical, 12)
        .animation(Theme.spring, value: state)
    }

    // MARK: Work

    private func poll() async {
        while !Task.isCancelled {
            await refreshJobs()
            if allDone { return }
            try? await Task.sleep(for: .seconds(3))
        }
    }

    private func refreshJobs() async {
        guard let api = app.api else {
            loaded = true
            return
        }
        do {
            let pending: [Job] = try await api.get("/api/jobs", query: ["pending": "1"])
            let pendingIds = Set(pending.map(\.id))
            var updated = jobs
            for job in pending { updated[job.id] = job }
            // Jobs that left the pending list have finished; fetch how they ended.
            var finished = false
            for (id, job) in jobs where !job.status.isFinished && !pendingIds.contains(id) {
                if let final: Job = try? await api.get("/api/jobs/\(id)"), final.status.isFinished {
                    updated[id] = final
                } else {
                    updated[id]?.status = .succeeded
                }
                finished = true
            }
            withAnimation(Theme.spring) {
                jobs = updated
                loaded = true
            }
            if finished { app.coachJobsChanged() }
        } catch is CancellationError {
        } catch {
            // Keep polling; Continue is always available.
        }
    }

    private struct AutoContinue: Equatable {
        var done: Bool
        var busy: Bool
    }

    /// Moves on a moment after everything finished, unless a permission prompt is up.
    private func autoContinue() async {
        guard allDone, !requesting else { return }
        let shown = Date.now.timeIntervalSince(appearedAt)
        try? await Task.sleep(for: .seconds(max(1.5, 3.5 - shown)))
        guard !Task.isCancelled, allDone, !requesting else { return }
        app.finishBuilding()
    }

    private func loadPermissionStates() async {
        switch await app.notifications.authorizationStatus() {
        case .authorized, .provisional, .ephemeral: reminders = .granted
        case .denied: reminders = .denied
        default: reminders = .available
        }
        health = app.healthSyncEnabled ? .granted : .available
    }

    private func allowReminders() {
        requesting = true
        Task {
            let granted = await app.notifications.requestPermission()
            if granted { app.notificationsEnabled = true }
            withAnimation(Theme.spring) { reminders = granted ? .granted : .denied }
            requesting = false
        }
    }

    private func connectHealth() {
        requesting = true
        Task {
            do {
                try await app.healthKit.requestAuthorization()
                app.healthSyncEnabled = true
                withAnimation(Theme.spring) { health = .granted }
                requesting = false
                await app.syncHealth()
            } catch {
                requesting = false
                app.report(error)
            }
        }
    }
}
