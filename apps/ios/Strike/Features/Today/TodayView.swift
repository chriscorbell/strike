import SwiftUI

enum TodayRoute: Hashable {
    case meal(slotIndex: Int)
}

/// The daily surface: what to eat and when, the workout, macros, weigh-in and check-in.
struct TodayView: View {
    @Environment(AppModel.self) private var app
    @Environment(TodayStore.self) private var store

    @State private var path = NavigationPath()
    @State private var showWorkoutTime = false
    @State private var showLogOther = false
    @State private var showCheckIn = false
    @State private var confirmDayChange: DayType?
    @State private var showDatePicker = false

    @AppStorage("askedNotificationPermission") private var askedNotifications = false

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let data = store.data {
                    content(data)
                } else if let error = store.loadError {
                    LoadErrorView(message: error) { await store.load() }
                } else {
                    ProgressView()
                        .controlSize(.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .background(Theme.screenBackground)
            .navigationTitle(title)
            .navigationSubtitle(store.data.map { Dates.long($0.date) } ?? "")
            .toolbar { toolbar }
            .navigationDestination(for: TodayRoute.self) { route in
                switch route {
                case let .meal(slotIndex):
                    MealSlotView(slotIndex: slotIndex)
                }
            }
            .refreshable { await store.load() }
        }
        .task {
            if store.data == nil { await store.load() }
            await askForNotificationsOnce()
        }
        .sheet(isPresented: $showWorkoutTime) {
            if let data = store.data, let workout = data.workout {
                WorkoutTimeSheet(current: workout.time, hasOverride: data.workoutTimeOverride != nil)
            }
        }
        .sheet(isPresented: $showLogOther) {
            LogMealSheet(slotIndex: nil, title: "Log a meal")
        }
        .sheet(isPresented: $showCheckIn) {
            CheckInSheet()
        }
        .sheet(isPresented: $showDatePicker) {
            DayPickerSheet(selected: store.date) { day in
                showDatePicker = false
                Task { await store.show(day) }
            }
        }
        .confirmationDialog(
            confirmDayChange == .rest ? (store.isShowingToday ? "Make today a rest day?" : "Make this a rest day?") : (store.isShowingToday ? "Train today?" : "Make this a training day?"),
            isPresented: Binding(get: { confirmDayChange != nil }, set: { if !$0 { confirmDayChange = nil } }),
            titleVisibility: .visible,
            presenting: confirmDayChange
        ) { type in
            Button(type == .rest ? "Make it a rest day" : "Make it a training day") {
                Task { await store.setDayType(type) }
            }
        } message: { type in
            Text(type == .rest
                ? "Today's session waits for your next training day, and meals switch to rest-day targets."
                : "Your next session is planned for today, and meals switch to training-day targets.")
        }
    }

    // MARK: Content

    private func content(_ data: TodayResponse) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                DaySwitcher(
                    date: data.date,
                    onStep: { days in Task { await store.step(by: days) } },
                    onPick: { showDatePicker = true }
                )
                DayHeader(data: data)

                if !data.pendingJobs.isEmpty {
                    CoachWorkingBanner(jobs: data.pendingJobs)
                }

                MacroSummaryCard(targets: data.targets, consumed: data.consumed)

                if data.weight.loggedKg == nil {
                    WeighInCard(trendKg: data.weight.trendKg)
                        .transition(.asymmetric(insertion: .opacity, removal: .scale(scale: 0.95).combined(with: .opacity)))
                }

                if data.checkIn.due {
                    checkInCard
                }

                if let upcoming = data.upcomingWeek {
                    UpcomingWeekCard(week: upcoming)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                DayTimeline(data: data, path: $path) {
                    showWorkoutTime = true
                }

                if !data.extraMeals.isEmpty {
                    extraMeals(data.extraMeals)
                }

                if data.dayType == .rest {
                    restDayFooter(data)
                }

                Button {
                    showLogOther = true
                } label: {
                    Label("Log something else", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.glass)
                .padding(.top, 4)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            // Exactly the screen's width, so nothing inside can make the page scroll sideways.
            .containerRelativeFrame(.horizontal)
            .animation(Theme.spring, value: data.weight.loggedKg)
            .animation(Theme.spring, value: data.pendingJobs.map(\.id))
        }
    }

    private var checkInCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "checklist")
                .font(.title2)
                .foregroundStyle(.tint)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("Weekly check-in")
                    .font(.headline)
                Text("Review the week and adjust calories.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Button("Run") { showCheckIn = true }
                .buttonStyle(.glassProminent)
        }
        .card()
    }

    private func extraMeals(_ logs: [MealLog]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionTitle("Also eaten")
            VStack(spacing: 0) {
                ForEach(Array(logs.enumerated()), id: \.element.id) { index, log in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(log.name)
                                .font(.body.weight(.medium))
                            MacroLine(macros: log.macros)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            Task { await store.undo(log) }
                        } label: {
                            Image(systemName: "arrow.uturn.backward")
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Remove \(log.name)")
                    }
                    .padding(.vertical, 8)
                    if index < logs.count - 1 { Divider() }
                }
            }
            .padding(.horizontal, Theme.padding)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    private func restDayFooter(_ data: TodayResponse) -> some View {
        VStack(spacing: 10) {
            if let next = data.nextSession {
                Text("Next session: \(next.label)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button("Train today instead") { confirmDayChange = .training }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.borderless)
                .disabled(store.isChangingDay)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: Toolbar

    private var title: String {
        guard let date = store.data?.date, !store.isShowingToday else { return "Today" }
        if date == Dates.adding(days: -1, to: Dates.today) { return "Yesterday" }
        if date == Dates.adding(days: 1, to: Dates.today) { return "Tomorrow" }
        return Dates.weekday(of: date).map { Dates.weekdays[$0] } ?? "Day"
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if !store.isShowingToday {
            ToolbarItem(placement: .topBarLeading) {
                Button("Today") { Task { await store.show(nil) } }
                    .accessibilityHint("Go back to today")
            }
        }
        if let data = store.data {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if data.workout != nil {
                        Button("Move workout", systemImage: "clock.arrow.2.circlepath") { showWorkoutTime = true }
                    }
                    if data.dayType == .training {
                        Button(store.isShowingToday ? "Make today a rest day" : "Make this a rest day", systemImage: "bed.double") { confirmDayChange = .rest }
                    } else {
                        Button(store.isShowingToday ? "Train today" : "Make this a training day", systemImage: "dumbbell") { confirmDayChange = .training }
                    }
                    Divider()
                    Button("Log a meal", systemImage: "fork.knife") { showLogOther = true }
                    Button("Run check-in", systemImage: "checklist") { showCheckIn = true }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .accessibilityLabel("Day options")
            }
            ToolbarSpacer(.fixed, placement: .topBarTrailing)
        }
        ToolbarItem(placement: .topBarTrailing) {
            SettingsToolbarButton()
        }
    }

    // MARK: Notifications

    private func askForNotificationsOnce() async {
        guard !askedNotifications, app.notificationsEnabled, store.data != nil else { return }
        askedNotifications = true
        if await app.notifications.requestPermission() {
            await store.load()
        }
    }
}

// MARK: - Header

private struct DayHeader: View {
    @Environment(AppModel.self) private var app
    var data: TodayResponse

    var body: some View {
        HStack(spacing: 8) {
            Tag(
                text: data.dayType.displayName,
                systemImage: data.dayType == .training ? "dumbbell.fill" : "bed.double.fill",
                tint: data.dayType == .training ? .accentColor : Theme.protein
            )
            if let meso = data.meso {
                Tag(text: meso.isDeload ? "Deload" : "Week \(meso.week + 1) of \(meso.hardWeeks)")
                Tag(text: "\(meso.targetRir) RIR")
            }
            Spacer(minLength: 0)
            if let kg = data.weight.loggedKg {
                Text(app.units.formatWeight(kg: kg))
                    .font(.subheadline.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Weighed \(app.units.formatWeight(kg: kg)) today")
            }
        }
        .padding(.top, 4)
    }
}

// MARK: - Macros

struct MacroSummaryCard: View {
    var targets: Macros
    var consumed: Macros

    @ScaledMetric(relativeTo: .title) private var ringSize: CGFloat = 112

    var body: some View {
        HStack(spacing: 20) {
            ZStack {
                ProgressRing(progress: targets.kcal > 0 ? consumed.kcal / targets.kcal : 0, color: Theme.kcal, lineWidth: 11)
                VStack(spacing: 0) {
                    Text(Fmt.integer(max(0, targets.kcal - consumed.kcal)))
                        .font(.number(.title2, weight: .bold))
                        .contentTransition(.numericText(value: consumed.kcal))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(consumed.kcal > targets.kcal ? "over" : "kcal left")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
            }
            .frame(width: ringSize, height: ringSize)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Calories")
            .accessibilityValue("\(Fmt.integer(consumed.kcal)) of \(Fmt.integer(targets.kcal)) eaten")

            VStack(spacing: 12) {
                MacroBar(label: "Protein", value: consumed.proteinG, target: targets.proteinG, color: Theme.protein)
                MacroBar(label: "Carbs", value: consumed.carbsG, target: targets.carbsG, color: Theme.carbs)
                MacroBar(label: "Fat", value: consumed.fatG, target: targets.fatG, color: Theme.fat)
            }
        }
        .card()
    }
}

// MARK: - Upcoming week

/// From the prep evening until the week starts: whether next week's plan and groceries are ready.
private struct UpcomingWeekCard: View {
    var week: UpcomingWeek

    @Environment(AppModel.self) private var app

    var body: some View {
        if week.ready {
            Button {
                app.showMeals(week: .next, section: .groceries)
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "cart.fill")
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .frame(width: 32)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Next week is planned")
                            .font(.headline)
                            .foregroundStyle(Color.primary)
                        Text("\(week.itemCount) items, about \(Fmt.usdWhole(week.costUsd)) · \(shopText)")
                            .font(.subheadline)
                            .foregroundStyle(Color.secondary)
                            .monospacedDigit()
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .card()
            .accessibilityHint("Opens next week's grocery list")
        } else {
            HStack(spacing: 14) {
                ProgressView()
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next week's plan is being written")
                        .font(.headline)
                    Text("The grocery list follows · \(shopText)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .card()
            .accessibilityElement(children: .combine)
        }
    }

    private var shopText: String {
        switch Dates.relative(week.shoppingDate) {
        case "Today": "Shop today"
        case "Tomorrow": "Shop tomorrow"
        default:
            if let day = Dates.weekday(of: week.shoppingDate) { "Shop \(Dates.weekdays[day])" } else { "Shop \(Dates.short(week.shoppingDate))" }
        }
    }
}
