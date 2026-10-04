import SwiftUI

/// Opens cook mode for one session of a menu's prep guide.
struct CookRoute: Hashable {
    var menuId: Int
    var session: Int
}

/// One prep session to follow start to finish in the kitchen: equipment, what to get out, the steps
/// with timers, and what to pack. Large text, big check targets, the screen stays awake.
struct CookModeView: View {
    let menuId: Int
    @State private var index: Int

    @Environment(AppModel.self) private var app
    @Environment(MealsStore.self) private var meals
    @State private var confirmReset = false
    @State private var didLoad = false

    init(route: CookRoute) {
        menuId = route.menuId
        _index = State(initialValue: route.session)
    }

    private var guide: PrepGuide? { meals.menu(id: menuId)?.prepGuide }
    private var session: PrepSession? { guide?.sessions[safe: index] }
    private var key: CookKey { CookKey(menuId: menuId, session: index, version: guide?.createdAt ?? "") }
    private var progress: CookProgress { meals.cookProgress(key) }

    var body: some View {
        Group {
            if let session {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 32) {
                            header(session)
                                .id("top")
                            if !session.equipment.isEmpty {
                                checklist("Equipment", items: session.equipment.map { ($0, nil) }, checked: progress.equipment) { i in
                                    toggle(\.equipment, i)
                                }
                            }
                            if !session.ingredients.isEmpty {
                                checklist("Get out", items: session.ingredients.map { ($0.item.prefix(1).uppercased() + $0.item.dropFirst(), $0.amount) }, checked: progress.ingredients) { i in
                                    toggle(\.ingredients, i)
                                }
                            }
                            steps(session)
                            if !session.containers.isEmpty {
                                pack(session)
                            }
                            sessionNavigation(proxy: proxy)
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                        .padding(.bottom, 32)
                    }
                }
            } else if didLoad {
                ContentUnavailableView("Prep session not found", systemImage: "frying.pan", description: Text("The guide may have been rewritten. Open it again from Meals → Prep."))
            } else {
                ProgressView()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Theme.screenBackground)
        .navigationTitle(session?.title ?? "Prep")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Reset checklist", systemImage: "arrow.counterclockwise", role: .destructive) {
                        confirmReset = true
                    }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .accessibilityLabel("Cook mode options")
            }
        }
        .confirmationDialog("Clear every check in this session?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset", role: .destructive) {
                withAnimation(Theme.spring) {
                    meals.updateCookProgress(key) { $0 = CookProgress() }
                }
                app.cookTimers.stopAll(menuId: menuId, session: index)
            }
        }
        .onAppear { app.isCooking = true }
        .onDisappear { app.isCooking = false }
        .task {
            if guide == nil { await meals.ensureMenu(id: menuId) }
            didLoad = true
        }
    }

    private func toggle(_ list: WritableKeyPath<CookProgress, Set<Int>>, _ item: Int) {
        withAnimation(Theme.snappy) {
            meals.updateCookProgress(key) { progress in
                if progress[keyPath: list].contains(item) {
                    progress[keyPath: list].remove(item)
                } else {
                    progress[keyPath: list].insert(item)
                }
            }
        }
    }

    // MARK: Header

    private func header(_ session: PrepSession) -> some View {
        let done = progress.steps.count
        let total = session.steps.count
        return VStack(alignment: .leading, spacing: 12) {
            Text(session.title)
                .font(.largeTitle.weight(.bold))
            Text("\(Dates.long(session.date)) · \(session.covers)")
                .font(.headline)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Tag(text: "\(Fmt.minutes(Double(session.activeMinutes))) hands-on", systemImage: "hand.raised.fill", tint: .accentColor)
                Tag(text: "\(Fmt.minutes(Double(session.totalMinutes))) total", systemImage: "clock")
            }
            if total > 0 {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(done) of \(total) steps")
                        .font(.subheadline.weight(.medium))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(done)))
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.accentColor.opacity(0.18))
                            Capsule().fill(Color.accentColor)
                                .frame(width: geo.size.width * Double(done) / Double(total))
                        }
                    }
                    .frame(height: 6)
                }
                .padding(.top, 4)
                .animation(Theme.spring, value: done)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Checklists

    private func checklist(_ title: String, items: [(String, String?)], checked: Set<Int>, toggle: @escaping (Int) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle(title, done: checked.count, total: items.count)
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                    let isChecked = checked.contains(i)
                    Button {
                        toggle(i)
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 14) {
                            CheckMark(isChecked: isChecked)
                            Text(item.0)
                                .font(.title3)
                                .strikethrough(isChecked, color: .secondary)
                                .foregroundStyle(isChecked ? Color.secondary : Color.primary)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if let amount = item.1 {
                                Text(amount)
                                    .font(.body)
                                    .foregroundStyle(Color.secondary)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(.vertical, 14)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .sensoryFeedback(.selection, trigger: isChecked)
                    .accessibilityAddTraits(isChecked ? [.isSelected] : [])
                    if i < items.count - 1 { Divider().padding(.leading, 42) }
                }
            }
            .padding(.horizontal, Theme.padding)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    private func sectionTitle(_ title: String, done: Int, total: Int) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title2.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Text("\(done)/\(total)")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(done == total && total > 0 ? Color.green : Color.secondary)
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(done)))
        }
        .padding(.horizontal, 4)
    }

    // MARK: Steps

    private func steps(_ session: PrepSession) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Steps", done: progress.steps.count, total: session.steps.count)
            VStack(spacing: 0) {
                ForEach(Array(session.steps.enumerated()), id: \.offset) { i, step in
                    StepRow(
                        number: i + 1,
                        step: step,
                        isDone: progress.steps.contains(i),
                        timerKey: CookTimers.Key(menuId: menuId, session: index, step: i),
                        sessionTitle: session.title
                    ) {
                        toggle(\.steps, i)
                    }
                    if i < session.steps.count - 1 { Divider().padding(.leading, 56) }
                }
            }
            .padding(.horizontal, Theme.padding)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    // MARK: Pack

    private func pack(_ session: PrepSession) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Pack", done: progress.containers.count, total: session.containers.count)
            VStack(spacing: 0) {
                ForEach(Array(session.containers.enumerated()), id: \.offset) { i, container in
                    let isChecked = progress.containers.contains(i)
                    Button {
                        toggle(\.containers, i)
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 14) {
                            CheckMark(isChecked: isChecked)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(container.label)
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(isChecked ? Color.secondary : Color.primary)
                                Text(container.contents)
                                    .font(.body)
                                    .foregroundStyle(Color.secondary)
                                    .multilineTextAlignment(.leading)
                                Label(storageText(container), systemImage: container.storage == .freezer ? "snowflake" : "refrigerator")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(container.storage == .freezer ? Theme.protein : Color.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 14)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .sensoryFeedback(.selection, trigger: isChecked)
                    .accessibilityAddTraits(isChecked ? [.isSelected] : [])
                    if i < session.containers.count - 1 { Divider().padding(.leading, 42) }
                }
            }
            .padding(.horizontal, Theme.padding)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    private func storageText(_ container: PrepSession.Container) -> String {
        let place = container.storage == .freezer ? "Freezer" : "Fridge"
        let day = Dates.weekday(of: container.eatBy).map { Dates.shortWeekdays[$0] } ?? Dates.short(container.eatBy)
        return "\(place) · eat by \(day)"
    }

    // MARK: Sessions

    @ViewBuilder
    private func sessionNavigation(proxy: ScrollViewProxy) -> some View {
        let sessions = guide?.sessions ?? []
        if sessions.count > 1 {
            HStack(spacing: 12) {
                if let previous = sessions[safe: index - 1] {
                    Button {
                        go(to: index - 1, proxy: proxy)
                    } label: {
                        Label(previous.title, systemImage: "chevron.left")
                            .font(.headline)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, minHeight: 40)
                    }
                    .buttonStyle(.glass)
                }
                if let next = sessions[safe: index + 1] {
                    Button {
                        go(to: index + 1, proxy: proxy)
                    } label: {
                        HStack(spacing: 6) {
                            Text(next.title)
                            Image(systemName: "chevron.right")
                        }
                        .font(.headline)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 40)
                    }
                    .buttonStyle(.glass)
                }
            }
            .controlSize(.large)
        }
    }

    private func go(to newIndex: Int, proxy: ScrollViewProxy) {
        withAnimation(Theme.spring) {
            index = newIndex
            proxy.scrollTo("top", anchor: .top)
        }
    }
}

// MARK: - Pieces

private struct CheckMark: View {
    var isChecked: Bool

    var body: some View {
        Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
            .font(.title2)
            .foregroundStyle(isChecked ? Color.accentColor : Color.secondary)
            .contentTransition(.symbolEffect(.replace))
            .frame(width: 28)
            .accessibilityHidden(true)
    }
}

/// A numbered step: tap to mark done; steps with a wait get a timer that counts down in the row.
private struct StepRow: View {
    var number: Int
    var step: PrepSession.Step
    var isDone: Bool
    var timerKey: CookTimers.Key
    var sessionTitle: String
    var toggle: () -> Void

    @Environment(AppModel.self) private var app
    @ScaledMetric(relativeTo: .title3) private var badge: CGFloat = 32

    private var timer: CookTimers.Timer? { app.cookTimers.timer(timerKey) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: toggle) {
                HStack(alignment: .top, spacing: 14) {
                    ZStack {
                        if isDone {
                            Circle().fill(Color.accentColor)
                            Image(systemName: "checkmark")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                        } else {
                            Circle().strokeBorder(Color.secondary.opacity(0.5), lineWidth: 1.5)
                            Text("\(number)")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: badge, height: badge)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(step.text)
                            .font(.title3)
                            .foregroundStyle(isDone ? Color.secondary : Color.primary)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if !step.tip.isEmpty {
                            Label {
                                Text(step.tip)
                            } icon: {
                                Image(systemName: "lightbulb")
                                    .foregroundStyle(Theme.carbs)
                            }
                            .font(.body)
                            .foregroundStyle(Color.secondary)
                            .multilineTextAlignment(.leading)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: isDone) { _, new in new }
            .accessibilityLabel("Step \(number). \(step.text)")
            .accessibilityValue(isDone ? "Done" : "")
            .accessibilityHint(isDone ? "Mark as not done" : "Mark as done")

            if step.timerMinutes > 0 {
                timerControl
                    .padding(.leading, badge + 14)
            }
        }
        .padding(.vertical, 16)
        .animation(Theme.spring, value: isDone)
    }

    @ViewBuilder
    private var timerControl: some View {
        if let timer, timer.finished {
            HStack(spacing: 12) {
                Label("Timer done", systemImage: "bell.fill")
                    .font(.headline)
                    .foregroundStyle(.tint)
                    .symbolEffect(.bounce, value: timer.finished)
                Spacer()
                Button("Dismiss") { app.cookTimers.stop(timerKey) }
                    .buttonStyle(.glass)
            }
        } else if let timer {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(timerInterval: Date.now ... max(timer.endsAt, Date.now), countsDown: true)
                        .font(.number(.title, weight: .bold))
                        .foregroundStyle(.tint)
                    ProgressView(timerInterval: timer.startedAt ... timer.endsAt, countsDown: true) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(.accentColor)
                }
                Button(role: .destructive) {
                    app.cookTimers.stop(timerKey)
                } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("Stop timer")
            }
        } else {
            Button {
                app.cookTimers.start(timerKey, minutes: step.timerMinutes, title: sessionTitle, step: step.text)
            } label: {
                Label("Start \(step.timerMinutes)-min timer", systemImage: "timer")
                    .font(.headline)
                    .frame(minHeight: 34)
            }
            .buttonStyle(.glassProminent)
        }
    }
}
