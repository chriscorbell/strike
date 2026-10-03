import SwiftUI

/// Where the Plan tab's navigation stack can go.
enum PlanRoute: Hashable {
    case session(Int)
    case exercise(id: String, name: String)
    case checkIn(Int)
    case allCheckIns
}

/// The Plan tab: the current training block, its session grid and days, and the weekly check-ins.
struct PlanView: View {
    @Environment(PlanStore.self) private var store
    @Environment(AppModel.self) private var app

    @State private var sheet: Sheet?
    @State private var expandedDays: Set<Int> = []
    @State private var seededExpansion: Int?

    private enum Sheet: String, Identifiable {
        case regenerate, note, checkIn
        var id: String { rawValue }
    }

    private var checkInDue: Bool { app.today.data?.checkIn.due == true }

    /// A check-in already covers the current or coming plan week (they run ahead of the week, the
    /// evening before grocery day), so running another would change nothing.
    private var checkInRanThisWeek: Bool {
        guard let latest = store.checkIns.first, let checkInDay = app.profile?.schedule.checkInDay else { return false }
        let today = app.today.data?.date ?? app.state?.today ?? Dates.today
        guard let weekday = Dates.weekday(of: today) else { return false }
        let weekStart = Dates.adding(days: -((weekday - checkInDay + 7) % 7), to: today)
        return latest.weekStart >= weekStart
    }
    private var nextSession: TodayResponse.NextSession? { app.today.data?.nextSession }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Plan")
                .toolbar { toolbar }
                .navigationDestination(for: PlanRoute.self) { route in
                    destination(route)
                }
        }
        .sheet(item: $sheet) { sheet in
            sheetView(sheet)
        }
        .task {
            if app.today.data == nil {
                async let today: Void = app.today.load()
                await store.load()
                await today
            } else {
                await store.load()
            }
        }
        .onChange(of: app.coachJobsTick) {
            Task { await store.load() }
        }
        .onChange(of: nextSession?.id) { old, _ in
            // A session was finished, skipped or rescheduled somewhere else.
            if old != nil { Task { await store.load() } }
        }
        .onChange(of: app.isWorkoutPresented) { _, presented in
            if !presented { Task { await store.load() } }
        }
        .sensoryFeedback(.success, trigger: store.meso?.id) { old, new in old != nil && new != nil && old != new }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if let meso = store.meso {
            loaded(meso)
        } else if store.hasLoaded {
            ContentUnavailableView {
                VStack(spacing: 16) {
                    ProgressView()
                        .controlSize(.large)
                    Text("The coach is writing your first block")
                }
            } description: {
                Text("It shows up here as soon as it's ready.")
            }
        } else if let error = store.loadError {
            LoadErrorView(message: error) { await store.load() }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func loaded(_ meso: MesoOverview) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacing) {
                if checkInDue {
                    CheckInDueCard { sheet = .checkIn }
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

                CoachWorkingBanner(jobs: store.coachJobs)

                MesoOverviewCard(meso: meso, position: app.today.data?.meso)

                SectionTitle("Sessions")
                MesoGridCard(
                    meso: meso,
                    nextSessionId: nextSession?.id,
                    currentWeek: currentWeek(of: meso),
                    openWorkout: { id in Task { await app.openWorkout(sessionId: id) } }
                )

                SectionTitle("Days")
                ForEach(meso.days.indices, id: \.self) { index in
                    MesoDayCard(
                        index: index,
                        day: meso.days[index],
                        isNext: isNextDay(index, of: meso),
                        isExpanded: expandedDays.contains(index),
                        toggle: { toggleDay(index) }
                    )
                }

                SectionTitle("Check-ins")
                if store.checkIns.isEmpty {
                    noCheckIns
                } else {
                    CheckInsCard(limit: 3)
                }
            }
            .padding(.horizontal, Theme.padding)
            .padding(.bottom, 32)
            .animation(Theme.spring, value: checkInDue)
            .animation(Theme.spring, value: store.coachJobs.map(\.id))
        }
        .background(Theme.screenBackground)
        .refreshable {
            async let today: Void = app.today.load()
            await store.load()
            await today
        }
        .onAppear { seedExpandedDay(in: meso) }
        .onChange(of: meso.id) { seedExpandedDay(in: meso) }
    }

    private var noCheckIns: some View {
        ContentUnavailableView {
            Label("No check-ins yet", systemImage: "checklist")
        } description: {
            if let prep = app.meals.response(for: .next)?.prepAt {
                Text("The first one runs \(Dates.medium(prep.date)) at \(Dates.display(prep.time)), ahead of grocery day.")
            } else if let schedule = app.profile?.schedule {
                Text("The first one runs \(Dates.weekdays[(schedule.effectiveShoppingDay + 6) % 7]) evening, ahead of grocery day.")
            }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Regenerate block…", systemImage: "arrow.triangle.2.circlepath") {
                    sheet = .regenerate
                }
                .disabled(store.meso == nil || store.isRegenerating)
                Button("Note to coach…", systemImage: "text.bubble") {
                    sheet = .note
                }
                if !checkInDue && !checkInRanThisWeek {
                    Button("Run check-in…", systemImage: "checklist") {
                        sheet = .checkIn
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
            }
            .accessibilityLabel("Plan actions")
        }
        ToolbarSpacer(.fixed, placement: .topBarTrailing)
        ToolbarItem(placement: .topBarTrailing) {
            SettingsToolbarButton()
        }
    }

    // MARK: Navigation and sheets

    @ViewBuilder
    private func destination(_ route: PlanRoute) -> some View {
        switch route {
        case let .session(id):
            SessionDetailView(sessionId: id)
        case let .exercise(id, name):
            ExerciseHistoryView(exerciseId: id, name: name)
        case let .checkIn(id):
            CheckInDetailView(checkInId: id)
        case .allCheckIns:
            CheckInListView()
        }
    }

    @ViewBuilder
    private func sheetView(_ sheet: Sheet) -> some View {
        switch sheet {
        case .regenerate:
            PlanNoteSheet(
                title: "New block",
                prompt: "Anything to change? (optional)",
                footer: "The coach writes a new block that replaces this one from your next session. Finished sessions stay in your history.",
                submitLabel: "Regenerate",
                confirmation: .init(
                    title: "Replace your training block?",
                    message: "The new block starts with your next session.",
                    action: "Replace block"
                ),
                submit: { note in await store.regenerate(note: note) }
            )
        case .note:
            PlanNoteSheet(
                title: "Note to coach",
                prompt: "Traveling next week, left knee is sore…",
                footer: "Used the next time the coach writes your plan or menu.",
                submitLabel: "Send",
                requiresNote: true,
                submit: { note in
                    guard let note else { return false }
                    return await store.sendNote(note)
                }
            )
        case .checkIn:
            PlanNoteSheet(
                title: "Weekly check-in",
                prompt: "How did the week go? (optional)",
                footer: "Reviews your weight trend, training and meals, then adjusts your calories. The coach reads your note.",
                submitLabel: "Run",
                submit: { note in await store.runCheckIn(note: note) }
            )
        }
    }

    // MARK: Helpers

    private func currentWeek(of meso: MesoOverview) -> Int? {
        guard meso.status == .active, let position = app.today.data?.meso, position.id == meso.id else { return nil }
        return position.week
    }

    private func isNextDay(_ index: Int, of meso: MesoOverview) -> Bool {
        guard let next = nextSession, next.dayIndex == index else { return false }
        return meso.grid.contains { row in row.contains { $0?.sessionId == next.id } }
    }

    private func toggleDay(_ index: Int) {
        withAnimation(Theme.spring) {
            if expandedDays.contains(index) {
                expandedDays.remove(index)
            } else {
                expandedDays.insert(index)
            }
        }
    }

    /// Opens the next session's day the first time a block is shown.
    private func seedExpandedDay(in meso: MesoOverview) {
        guard seededExpansion != meso.id else { return }
        seededExpansion = meso.id
        if let index = meso.days.indices.first(where: { isNextDay($0, of: meso) }) {
            expandedDays = [index]
        } else {
            expandedDays = []
        }
    }
}
