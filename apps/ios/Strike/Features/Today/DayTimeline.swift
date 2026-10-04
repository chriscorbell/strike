import SwiftUI

/// Meals and the workout in time order, on a rail. The next item gets quick actions.
struct DayTimeline: View {
    var data: TodayResponse
    @Binding var path: NavigationPath
    var onMoveWorkout: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(TodayStore.self) private var store
    @State private var logOtherSlot: TimelineMeal?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Schedule")
            if data.timeline.isEmpty {
                Text(data.menuReady ? "Nothing planned today." : "Your meals appear here once the coach has written this week's menu.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
            } else {
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    let next = nextItemID(at: context.date)
                    VStack(spacing: 0) {
                        ForEach(Array(data.timeline.enumerated()), id: \.element.id) { index, item in
                            TimelineRow(
                                time: item.time,
                                state: state(of: item, nextID: next),
                                isFirst: index == 0,
                                isLast: index == data.timeline.count - 1
                            ) {
                                switch item {
                                case let .meal(meal):
                                    MealEntry(meal: meal, isNext: item.id == next, path: $path) {
                                        logOtherSlot = meal
                                    }
                                case let .workout(workout):
                                    WorkoutEntry(workout: workout, isNext: item.id == next, onMove: onMoveWorkout)
                                }
                            }
                        }
                    }
                }
            }
        }
        .sheet(item: $logOtherSlot) { meal in
            LogMealSheet(slotIndex: meal.slotIndex, title: meal.label)
        }
    }

    private func minutes(_ date: Date) -> Int {
        Dates.minutes(of: Dates.timeOfDay(from: date)) ?? 0
    }

    /// The first item still ahead of us (a meal within its hour, or a workout not yet over).
    private func nextItemID(at date: Date) -> String? {
        // Quick actions belong to today only; other days are for looking ahead or filling in.
        guard data.date == Dates.today else { return nil }
        let now = minutes(date)
        for item in data.timeline {
            switch item {
            case let .meal(meal):
                if meal.log == nil, (Dates.minutes(of: meal.time) ?? 0) + 60 >= now { return item.id }
            case let .workout(workout):
                if workout.status == .inProgress { return item.id }
                if workout.status == .planned, (Dates.minutes(of: workout.endTime) ?? 0) >= now { return item.id }
            }
        }
        return nil
    }

    private func state(of item: TimelineItem, nextID: String?) -> TimelineMarker {
        switch item {
        case let .meal(meal):
            if let log = meal.log { return log.status == .eaten ? .done : .skipped }
        case let .workout(workout):
            if workout.status == .completed { return .done }
            if workout.status == .skipped { return .skipped }
        }
        return item.id == nextID ? .next : .upcoming
    }
}

extension TimelineMeal: Identifiable {
    var id: Int { slotIndex }
}

// MARK: - Row scaffold

/// Time label, rail and marker beside the item's content.
enum TimelineMarker { case done, skipped, next, upcoming }

struct TimelineRow<Content: View>: View {
    var time: TimeOfDay
    var state: TimelineMarker
    var isFirst: Bool
    var isLast: Bool
    @ViewBuilder var content: Content

    @ScaledMetric(relativeTo: .footnote) private var timeWidth: CGFloat = 58

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(Dates.display(time))
                .font(.footnote.weight(state == .next ? .semibold : .regular))
                .monospacedDigit()
                .foregroundStyle(state == .next ? Color.primary : Color.secondary)
                .frame(width: timeWidth, alignment: .trailing)
                .padding(.top, 19)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            ZStack(alignment: .top) {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(isFirst ? Color.clear : Color.secondary.opacity(0.25))
                        .frame(width: 2, height: 22)
                    Rectangle()
                        .fill(isLast ? Color.clear : Color.secondary.opacity(0.25))
                        .frame(width: 2)
                }
                marker
                    .padding(.top, 16)
            }
            .frame(width: 18)

            content
                .padding(.bottom, isLast ? 0 : 10)
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var marker: some View {
        switch state {
        case .done:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.green)
                .background(Circle().fill(Theme.screenBackground))
        case .skipped:
            Image(systemName: "minus.circle.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.secondary)
                .background(Circle().fill(Theme.screenBackground))
        case .next:
            Circle()
                .fill(Color.accentColor)
                .frame(width: 12, height: 12)
                .padding(2)
                .background(Circle().fill(Color.accentColor.opacity(0.25)).frame(width: 20, height: 20))
        case .upcoming:
            Circle()
                .strokeBorder(Color.secondary.opacity(0.6), lineWidth: 2)
                .background(Circle().fill(Theme.screenBackground))
                .frame(width: 12, height: 12)
                .padding(2)
        }
    }
}

// MARK: - Meal

private struct MealEntry: View {
    var meal: TimelineMeal
    var isNext: Bool
    @Binding var path: NavigationPath
    var onSomethingElse: () -> Void

    @Environment(TodayStore.self) private var store

    private var featured: MealOption? { meal.options.first }
    private var busy: Bool { store.busySlots.contains(meal.slotIndex) }

    @ViewBuilder private var actionButtons: some View {
        if let featured {
            Button {
                Task { await store.log(featured, for: meal) }
            } label: {
                Group {
                    if busy {
                        ProgressView().tint(.white)
                    } else {
                        Label("Ate this", systemImage: "checkmark")
                            .lineLimit(1)
                    }
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 30)
            }
            .buttonStyle(.glassProminent)
            .disabled(busy)
        }
        Button {
            onSomethingElse()
        } label: {
            Text("Something else")
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 30)
        }
        .buttonStyle(.glass)
        .disabled(busy)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                path.append(TodayRoute.meal(slotIndex: meal.slotIndex))
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(meal.label)
                            .font(meal.plannedOption != nil && meal.log == nil ? .subheadline.weight(.semibold) : .headline)
                            .foregroundStyle(meal.plannedOption != nil && meal.log == nil ? Color.secondary : Color.primary)
                        if let role = meal.role.displayName, role.lowercased() != meal.label.lowercased() {
                            Text(role)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    if let log = meal.log {
                        if log.status == .eaten {
                            Text(log.name)
                                .font(.subheadline)
                                .lineLimit(2)
                            MacroLine(macros: log.macros)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Skipped")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    } else if let planned = meal.plannedOption {
                        // The week's plan says what to eat: lead with the dish.
                        Text(featuredTitle(planned))
                            .font(.body.weight(.semibold))
                            .lineLimit(2)
                        Text("\(Fmt.kcal(planned.macros.kcal)) · \(Fmt.integer(planned.macros.proteinG))g protein\(planned.kind == .out ? " · grab and go" : "")")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    } else {
                        Text("\(Fmt.integer(meal.targets.proteinG))g protein · \(Fmt.kcal(meal.targets.kcal))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                        if let featured {
                            HStack(spacing: 6) {
                                Image(systemName: featured.kind == .home ? "frying.pan" : "bag")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(featuredTitle(featured))
                                    .font(.subheadline.weight(.medium))
                                    .lineLimit(2)
                            }
                            .padding(.top, 2)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)

            if isNext, meal.log == nil {
                // Side by side when they fit; stacked on narrow cards or large text, so the row never
                // grows wider than the card (that made the whole Today page scroll sideways).
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) { actionButtons }
                    VStack(spacing: 8) { actionButtons }
                }
                .transition(.opacity)
            }
        }
        .card(padding: 14)
        .contextMenu {
            if let log = meal.log {
                Button("Undo", systemImage: "arrow.uturn.backward") {
                    Task { await store.undo(log) }
                }
            } else {
                if let featured {
                    Button("Ate \(featured.name)", systemImage: "checkmark") {
                        Task { await store.log(featured, for: meal) }
                    }
                }
                Button("Something else…", systemImage: "square.and.pencil", action: onSomethingElse)
                Button("Skipped", systemImage: "minus.circle") {
                    Task { await store.skip(meal) }
                }
            }
        }
        .animation(Theme.spring, value: meal.log)
    }

    private func featuredTitle(_ option: MealOption) -> String {
        if option.kind == .out, let place = option.place, !place.isEmpty {
            return "\(place): \(option.name)"
        }
        return option.name
    }
}

// MARK: - Workout

private struct WorkoutEntry: View {
    var workout: TimelineWorkout
    var isNext: Bool
    var onMove: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(TodayStore.self) private var store

    /// A planned session seen on another day is a preview: starting it always starts it today.
    private var isPreview: Bool { workout.status == .planned && !store.isShowingToday }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(workout.label)
                    .font(.title3.weight(.semibold))
                Spacer()
                statusTag
            }
            VStack(alignment: .leading, spacing: 4) {
                Label("\(Dates.display(workout.time)) – \(Dates.display(workout.endTime))", systemImage: "clock")
                Label("\(workout.location.displayName) · \(workout.exerciseCount) exercises · \(workout.setCount) sets", systemImage: workout.location.symbol)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .monospacedDigit()

            HStack(spacing: 8) {
                Button {
                    Task { await app.openWorkout(sessionId: workout.sessionId) }
                } label: {
                    Label(primaryTitle, systemImage: primaryIcon)
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(WorkoutEntryButtonStyle(prominent: !isPreview && (workout.status == .planned || workout.status == .inProgress)))

                if workout.status == .planned {
                    Button(action: onMove) {
                        Image(systemName: "clock.arrow.2.circlepath")
                            .font(.headline)
                            .frame(width: 30, height: 34)
                    }
                    .buttonStyle(.glass)
                    .accessibilityLabel("Move workout time")
                }
            }
        }
        .card()
        .overlay {
            if isNext {
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Color.accentColor.opacity(0.5), lineWidth: 1.5)
            }
        }
    }

    private var primaryTitle: String {
        if isPreview { return "Preview" }
        switch workout.status {
        case .planned: return "Start"
        case .inProgress: return "Continue"
        case .completed, .skipped: return "View"
        }
    }

    private var primaryIcon: String {
        if isPreview { return "eye" }
        switch workout.status {
        case .planned: return "play.fill"
        case .inProgress: return "arrow.right"
        case .completed, .skipped: return "list.bullet"
        }
    }

    @ViewBuilder
    private var statusTag: some View {
        switch workout.status {
        case .planned: EmptyView()
        case .inProgress: Tag(text: "In progress", tint: .accentColor)
        case .completed: Tag(text: "Done", systemImage: "checkmark", tint: .green)
        case .skipped: Tag(text: "Skipped")
        }
    }
}

/// Prominent glass for a workout still to do, plain glass once it's done.
private struct WorkoutEntryButtonStyle: PrimitiveButtonStyle {
    var prominent: Bool

    func makeBody(configuration: Configuration) -> some View {
        if prominent {
            Button(role: configuration.role, action: configuration.trigger) { configuration.label }
                .buttonStyle(.glassProminent)
        } else {
            Button(role: configuration.role, action: configuration.trigger) { configuration.label }
                .buttonStyle(.glass)
        }
    }
}
