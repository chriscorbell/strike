import SwiftUI

/// This week and next week: the day-by-day meal plan, the grocery list it adds up to, and prep.
struct MealsView: View {
    @Environment(AppModel.self) private var app
    @Environment(MealsStore.self) private var meals

    @State private var regenerateWeek: MenuWeek?
    @State private var isHistoryPresented = false
    @State private var swapRef: PlanSlotRef?
    @State private var fallbackDayType: DayType?

    var body: some View {
        @Bindable var meals = meals
        NavigationStack {
            List {
                Section {
                    Picker("Week", selection: $meals.week.animation(Theme.snappy)) {
                        Text("This week").tag(MenuWeek.current)
                        Text("Next week").tag(MenuWeek.next)
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)
                    if meals.menu(for: meals.week) != nil {
                        Picker("Section", selection: $meals.section.animation(Theme.snappy)) {
                            ForEach(MealsSection.allCases) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                }
                .labelsHidden()
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))

                content
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(.compact)
            .navigationTitle("Meals")
            .navigationSubtitle(subtitle)
            .toolbar { toolbar }
            .navigationDestination(for: MealOption.self) { option in
                MealOptionDetailView(option: option)
            }
            .navigationDestination(isPresented: $isHistoryPresented) {
                MealsHistoryView()
            }
            .sheet(item: $regenerateWeek) { week in
                MealsRegenerateSheet(week: week) { note in
                    Task { await meals.regenerate(note: note, week: week) }
                }
            }
            .sheet(item: $swapRef) { ref in
                PlanSwapSheet(ref: ref)
            }
            .refreshable { await meals.loadAll() }
            .task { await meals.loadAll() }
            .onChange(of: app.coachJobsTick) { _, tick in
                Task { await meals.coachJobsTickChanged(tick) }
            }
            .onChange(of: app.mealsFocus, initial: true) { _, focus in
                guard let focus else { return }
                meals.week = focus.week
                meals.section = focus.section
                app.mealsFocus = nil
            }
        }
    }

    private var subtitle: String {
        guard let menu = meals.menu(for: meals.week) else { return "" }
        let end = Dates.adding(days: 6, to: menu.weekStart)
        let range = "\(Dates.short(menu.weekStart)) – \(Dates.short(end))"
        return menu.source == .fallback ? "\(range) · Default menu" : range
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        let week = meals.week
        if let menu = meals.menu(for: week) {
            if meals.isCoachWriting(week) {
                Section { MealsWritingRow(week: week) }
            }
            switch meals.section {
            case .plan:
                if menu.plan.isEmpty {
                    fallbackOptions(menu)
                } else {
                    MealsPlanSections(menu: menu, week: week) { swapRef = $0 }
                }
            case .groceries:
                MealsGrocerySections(menu: menu)
            case .prep:
                MealsPrepSections(menu: menu)
            }
        } else if meals.isCoachWriting(week) {
            Section { MealsWritingRow(week: week) }
        } else if let error = meals.loadErrors[week] {
            Section {
                LoadErrorView(message: error) { await meals.load(week) }
            }
        } else if !meals.hasLoaded(week) {
            Section {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
            .listRowBackground(Color.clear)
        } else if week == .next {
            Section {
                ContentUnavailableView {
                    Label(prepTitle, systemImage: "calendar.badge.clock")
                } description: {
                    Text(prepDetail)
                } actions: {
                    Button("Write it now") { regenerateWeek = .next }
                        .buttonStyle(.glass)
                }
            }
            .listRowBackground(Color.clear)
        } else {
            Section {
                ContentUnavailableView {
                    Label("No menu yet", systemImage: "fork.knife")
                } description: {
                    Text("Ask the coach to plan this week's meals.")
                } actions: {
                    Button("Write menu") { regenerateWeek = .current }
                        .buttonStyle(.glassProminent)
                }
            }
            .listRowBackground(Color.clear)
        }
    }

    /// "Ready Friday evening", from when the server prepares next week.
    private var prepTitle: String {
        guard let prep = meals.response(for: .next)?.prepAt else { return "Not ready yet" }
        let minutes = Dates.minutes(of: prep.time) ?? 0
        let part = minutes >= 17 * 60 ? "evening" : minutes >= 12 * 60 ? "afternoon" : "morning"
        let day = Dates.weekday(of: prep.date).map { Dates.weekdays[$0] } ?? Dates.short(prep.date)
        return "Ready \(day) \(part)"
    }

    private var prepDetail: String {
        guard let response = meals.response(for: .next) else { return "" }
        let at = "\(Dates.medium(response.prepAt.date)) at \(Dates.display(response.prepAt.time))"
        return "Next week's plan and grocery list are written \(at), after your check-in. Grocery day is \(Dates.medium(response.shoppingDate))."
    }

    // MARK: Fallback for menus without a plan

    @ViewBuilder
    private func fallbackOptions(_ menu: MealMenu) -> some View {
        let day = fallbackDayType ?? app.today.data?.dayType ?? .training
        Section {
            Picker("Day type", selection: Binding(get: { day }, set: { fallbackDayType = $0 })) {
                ForEach(DayType.allCases) { Text($0.displayName).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())

        ForEach(menu.slots.filter { $0.dayType == day }.sorted { $0.slotIndex < $1.slotIndex }, id: \.slotIndex) { slot in
            Section {
                ForEach(slot.options.filter { $0.kind == .home } + slot.options.filter { $0.kind == .out }) { option in
                    NavigationLink(value: option) {
                        MealsOptionRow(option: option)
                    }
                }
            } header: {
                MealsSlotHeader(label: slot.label, role: slot.role, targets: slot.targets)
            }
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button {
                    regenerateWeek = meals.week
                } label: {
                    Label(meals.week == .next ? "Rewrite next week…" : "New menu…", systemImage: "arrow.clockwise")
                }
                .disabled(meals.isCoachWriting(meals.week))
                if meals.section == .groceries, let menu = meals.menu(for: meals.week) {
                    Button {
                        withAnimation(Theme.snappy) { meals.uncheckAll(menuId: menu.id) }
                    } label: {
                        Label("Uncheck all groceries", systemImage: "circle")
                    }
                    .disabled(meals.checked[menu.id]?.isEmpty ?? true)
                }
                Button {
                    isHistoryPresented = true
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
            } label: {
                Image(systemName: "ellipsis")
            }
            .accessibilityLabel("Menu options")
        }
        ToolbarSpacer(.fixed, placement: .topBarTrailing)
        ToolbarItem(placement: .topBarTrailing) {
            SettingsToolbarButton()
        }
    }
}

// MARK: - Shared rows

/// Section header for a meal: its name, role and macro targets.
struct MealsSlotHeader: View {
    var label: String
    var role: MealRole
    var targets: Macros

    /// Hides the role when the label already says it ("Pre-workout" / pre-workout).
    private var roleName: String? {
        guard let name = role.displayName, !label.localizedCaseInsensitiveContains(name) else { return nil }
        return name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(label)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.primary)
                if let roleName {
                    Tag(text: roleName, tint: .accentColor)
                }
            }
            MacroLine(macros: targets)
                .foregroundStyle(.secondary)
        }
        .textCase(nil)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Round icon for home-cooked vs grab-and-go.
struct MealKindIcon: View {
    var kind: MealOptionKind

    var body: some View {
        let tint = kind == .home ? Theme.protein : Theme.carbs
        Image(systemName: kind == .home ? "frying.pan.fill" : "bag.fill")
            .font(.footnote)
            .foregroundStyle(tint)
            .frame(width: 30, height: 30)
            .background(tint.opacity(0.14), in: .circle)
            .accessibilityHidden(true)
    }
}

/// One meal option: what it is, where to get it, and its calories, protein, time and cost.
struct MealsOptionRow: View {
    var option: MealOption

    private var isHome: Bool { option.kind == .home }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            MealKindIcon(kind: option.kind)
            VStack(alignment: .leading, spacing: 3) {
                Text(option.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.primary)
                if !isHome, let place = option.place, !place.isEmpty {
                    Text(place)
                        .font(.subheadline)
                        .foregroundStyle(Color.secondary)
                }
                stats
                    .font(.footnote)
                    .foregroundStyle(Color.secondary)
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(option.name)
        .accessibilityValue(accessibilityValue)
    }

    private var stats: Text {
        let protein = Text("\(Fmt.integer(option.macros.proteinG))g protein").foregroundStyle(Theme.protein)
        var line = Text("\(Fmt.kcal(option.macros.kcal)) · \(protein)")
        if option.prepMinutes > 0 {
            line = Text("\(line) · \(Fmt.minutes(option.prepMinutes))")
        }
        return Text("\(line) · \(Fmt.usd(option.costUsd))")
    }

    private var accessibilityValue: String {
        var parts = [isHome ? "Cook at home" : "Grab and go"]
        if !isHome, let place = option.place, !place.isEmpty { parts.append(place) }
        parts.append("\(Fmt.integer(option.macros.kcal)) calories")
        parts.append("\(Fmt.integer(option.macros.proteinG)) grams protein")
        if option.prepMinutes > 0 { parts.append(Fmt.minutes(option.prepMinutes)) }
        parts.append(Fmt.usd(option.costUsd))
        return parts.joined(separator: ", ")
    }
}

/// Shown while the coach writes a menu.
private struct MealsWritingRow: View {
    var week: MenuWeek

    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
            VStack(alignment: .leading, spacing: 2) {
                Text(week == .next ? "Writing next week's plan" : "Writing a new menu")
                    .font(.subheadline.weight(.semibold))
                Text("The grocery list follows from it.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Regenerate

/// Optional note for the coach before it rewrites a week's menu and plan.
private struct MealsRegenerateSheet: View {
    var week: MenuWeek
    var onSubmit: (String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var note = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Anything to change?", text: $note, axis: .vertical)
                        .lineLimit(3 ... 6)
                        .focused($isFocused)
                } footer: {
                    Text("Optional. For example: more fish, cheaper lunches, no eggs. The plan and grocery list are replaced.")
                }
            }
            .navigationTitle(week == .next ? "Rewrite next week" : "New menu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Write", role: .confirm) {
                        onSubmit(note)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { isFocused = true }
    }
}
