import SwiftUI

/// One meal slot today: its targets, what was logged, and every option grouped Home vs Grab-and-go.
struct MealSlotView: View {
    var slotIndex: Int

    @Environment(TodayStore.self) private var store
    @State private var showLogOther = false
    @State private var confirmSkip = false

    private var meal: TimelineMeal? {
        store.data?.meals.first { $0.slotIndex == slotIndex }
    }

    var body: some View {
        Group {
            if let meal {
                content(meal)
            } else {
                ContentUnavailableView("Meal not found", systemImage: "fork.knife")
            }
        }
        .background(Theme.screenBackground)
        .navigationTitle(meal?.label ?? "Meal")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: MealOption.self) { option in
            if let meal {
                MealOptionDetailView(option: option, logTitle: meal.log?.optionId == option.id ? "Logged" : "Ate this") {
                    await store.log(option, for: meal)
                }
            }
        }
        .sheet(isPresented: $showLogOther) {
            if let meal {
                LogMealSheet(slotIndex: meal.slotIndex, title: meal.label)
            }
        }
    }

    private func content(_ meal: TimelineMeal) -> some View {
        let planned = meal.plannedOption
        let others = meal.options.filter { $0.id != planned?.id }
        let home = others.filter { $0.kind == .home }
        let out = others.filter { $0.kind == .out }
        let busy = store.busySlots.contains(meal.slotIndex)
        let findingMore = store.optionJobSlots.contains(meal.slotIndex)

        return ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header(meal)

                if let log = meal.log {
                    loggedCard(log, busy: busy)
                        .transition(.scale(scale: 0.96).combined(with: .opacity))
                }

                if let planned {
                    plannedCard(planned, meal: meal, busy: busy)
                    if !others.isEmpty {
                        optionSection("Other options", systemImage: "square.grid.2x2", options: home + out, meal: meal, busy: busy)
                    }
                } else {
                    if !home.isEmpty {
                        optionSection("Cook at home", systemImage: "frying.pan", options: home, meal: meal, busy: busy)
                    }
                    if !out.isEmpty {
                        optionSection("Grab and go", systemImage: "bag", options: out, meal: meal, busy: busy)
                    }
                }
                if meal.options.isEmpty {
                    Text("No options yet. The coach adds them with this week's menu.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 10) {
                    Button {
                        Task { await store.requestMoreOptions(for: meal) }
                    } label: {
                        HStack(spacing: 8) {
                            if findingMore {
                                ProgressView()
                                Text("Finding more options…")
                            } else {
                                Image(systemName: "sparkles")
                                Text("More options")
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.glass)
                    .disabled(findingMore)

                    if meal.log == nil {
                        HStack(spacing: 10) {
                            Button {
                                showLogOther = true
                            } label: {
                                Label("Something else", systemImage: "square.and.pencil")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity, minHeight: 36)
                            }
                            .buttonStyle(.glass)
                            Button {
                                confirmSkip = true
                            } label: {
                                Label("Skipped", systemImage: "minus.circle")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity, minHeight: 36)
                            }
                            .buttonStyle(.glass)
                        }
                        .disabled(busy)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 56)
            .animation(Theme.spring, value: meal.log)
            .animation(Theme.spring, value: meal.options.count)
        }
        .confirmationDialog("Skip \(meal.label.lowercased())?", isPresented: $confirmSkip, titleVisibility: .visible) {
            Button("Mark as skipped") { Task { await store.skip(meal) } }
        }
    }

    private func header(_ meal: TimelineMeal) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label(Dates.display(meal.time), systemImage: "clock")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                if let role = meal.role.displayName, role.lowercased() != meal.label.lowercased() {
                    Tag(text: role, tint: .accentColor)
                }
            }
            HStack(spacing: 0) {
                target(Fmt.integer(meal.targets.kcal), "kcal", .primary)
                target("\(Fmt.integer(meal.targets.proteinG))g", "protein", Theme.protein)
                target("\(Fmt.integer(meal.targets.carbsG))g", "carbs", Theme.carbs)
                target("\(Fmt.integer(meal.targets.fatG))g", "fat", Theme.fat)
            }
            .card(padding: 14)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Target: \(Fmt.integer(meal.targets.kcal)) calories, \(Fmt.integer(meal.targets.proteinG)) grams protein")
        }
    }

    private func target(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.number(.headline))
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func loggedCard(_ log: MealLog, busy: Bool) -> some View {
        HStack(spacing: 14) {
            Image(systemName: log.status == .eaten ? "checkmark.circle.fill" : "minus.circle.fill")
                .font(.title2)
                .foregroundStyle(log.status == .eaten ? Color.green : Color.secondary)
            VStack(alignment: .leading, spacing: 3) {
                Text(log.status == .eaten ? log.name : "Skipped")
                    .font(.headline)
                if log.status == .eaten {
                    MacroLine(macros: log.macros)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            Button {
                Task { await store.undo(log) }
            } label: {
                if busy {
                    ProgressView()
                } else {
                    Text("Undo")
                }
            }
            .buttonStyle(.glass)
            .disabled(busy)
        }
        .card()
    }

    /// The dish the week's plan assigns to this meal, with one-tap logging.
    private func plannedCard(_ option: MealOption, meal: TimelineMeal, busy: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Planned", systemImage: "calendar")
                .font(.title3.weight(.semibold))
                .padding(.horizontal, 4)
            VStack(alignment: .leading, spacing: 14) {
                NavigationLink(value: option) {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(option.kind == .out ? "\(option.place.map { "\($0): " } ?? "")\(option.name)" : option.name)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(Color.primary)
                                .multilineTextAlignment(.leading)
                            if option.hasUsefulSummary {
                                Text(option.summary)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.secondary)
                                    .multilineTextAlignment(.leading)
                            }
                            HStack(spacing: 10) {
                                MacroLine(macros: option.macros, font: .footnote)
                                if option.prepMinutes > 0 {
                                    Text(Fmt.minutes(option.prepMinutes))
                                        .font(.footnote)
                                        .foregroundStyle(Color.secondary)
                                }
                            }
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)

                if meal.log == nil {
                    Button {
                        Task { await store.log(option, for: meal) }
                    } label: {
                        Group {
                            if busy {
                                ProgressView().tint(.white)
                            } else {
                                Label("Ate this", systemImage: "checkmark")
                            }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 34)
                    }
                    .buttonStyle(.glassProminent)
                    .disabled(busy)
                } else if meal.log?.optionId == option.id {
                    Label("Logged", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.green)
                }
            }
            .card()
        }
    }

    private func optionSection(_ title: String, systemImage: String, options: [MealOption], meal: TimelineMeal, busy: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: systemImage)
                .font(.title3.weight(.semibold))
                .padding(.horizontal, 4)
            VStack(spacing: 0) {
                ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                    OptionRow(
                        option: option,
                        isFeatured: option.id == meal.options.first?.id,
                        isLogged: meal.log?.optionId == option.id,
                        canLog: meal.log == nil && !busy
                    ) {
                        Task { await store.log(option, for: meal) }
                    }
                    if index < options.count - 1 {
                        Divider().padding(.leading, Theme.padding)
                    }
                }
            }
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }
}

private struct OptionRow: View {
    var option: MealOption
    var isFeatured: Bool
    var isLogged: Bool
    var canLog: Bool
    var onLog: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            NavigationLink(value: option) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text(option.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                        if isFeatured {
                            Image(systemName: "star.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.carbs)
                                .accessibilityLabel("Suggested")
                        }
                    }
                    if option.kind == .out, let place = option.place, !place.isEmpty {
                        Text(place)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    if option.hasUsefulSummary {
                        Text(option.summary)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    HStack(spacing: 10) {
                        MacroLine(macros: option.macros, font: .caption)
                        Text("·").foregroundStyle(.tertiary).accessibilityHidden(true)
                        Text(Fmt.usd(option.costUsd))
                        if option.prepMinutes > 0 {
                            Text(Fmt.minutes(option.prepMinutes))
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)

            if isLogged {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.green)
                    .frame(width: 44, height: 44)
                    .accessibilityLabel("Logged")
            } else if canLog {
                Button(action: onLog) {
                    Image(systemName: "checkmark.circle")
                        .font(.title2)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Ate \(option.name)")
            }
        }
        .padding(.leading, Theme.padding)
        .padding(.trailing, 8)
        .padding(.vertical, 12)
    }
}
