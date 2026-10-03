import SwiftUI

/// The week's menu: meal slots and their options for training and rest days, the grocery list,
/// prep tips and the coach's note.
struct MealsView: View {
    @Environment(AppModel.self) private var app
    @Environment(MealsStore.self) private var meals

    @State private var dayType: DayType?
    @State private var isRegenerateSheetPresented = false
    @State private var isHistoryPresented = false

    /// Starts on today's day type until the user picks one.
    private var selectedDay: Binding<DayType> {
        Binding(
            get: { dayType ?? app.today.data?.dayType ?? .training },
            set: { newValue in withAnimation(Theme.snappy) { dayType = newValue } }
        )
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Meals")
                .navigationSubtitle(subtitle)
                .toolbar { toolbar }
                .navigationDestination(for: MealOption.self) { option in
                    MealOptionDetailView(option: option)
                }
                .navigationDestination(isPresented: $isHistoryPresented) {
                    MealsHistoryView()
                }
                .sheet(isPresented: $isRegenerateSheetPresented) {
                    MealsRegenerateSheet { note in
                        Task { await meals.regenerate(note: note) }
                    }
                }
                .task { await meals.load() }
                .onChange(of: app.coachJobsTick) { _, tick in
                    Task { await meals.coachJobsTickChanged(tick) }
                }
        }
    }

    private var subtitle: String {
        guard let menu = meals.menu else { return "" }
        let week = "Week of \(Dates.short(menu.weekStart))"
        return menu.source == .fallback ? "\(week) · Default menu" : week
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if let menu = meals.menu {
            menuList(menu)
        } else if meals.isCoachWriting {
            ContentUnavailableView {
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                    Text("Writing your menu")
                }
            } description: {
                Text("Your coach is planning this week's meals.")
            }
            .transition(.opacity)
        } else if let error = meals.loadError {
            LoadErrorView(message: error) { await meals.load() }
        } else if meals.hasLoaded {
            ContentUnavailableView {
                Label("No menu yet", systemImage: "fork.knife")
            } description: {
                Text("Ask the coach to write this week's menu.")
            } actions: {
                Button("Write menu") { isRegenerateSheetPresented = true }
                    .buttonStyle(.glassProminent)
            }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func menuList(_ menu: MealMenu) -> some View {
        let day = selectedDay.wrappedValue
        let slots = menu.slots
            .filter { $0.dayType == day }
            .sorted { $0.slotIndex < $1.slotIndex }

        return List {
            if meals.isCoachWriting {
                Section {
                    MealsWritingRow()
                }
            }

            Section {
                Picker("Day type", selection: selectedDay) {
                    ForEach(DayType.allCases) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            if slots.isEmpty {
                Section {
                    Text("No meals planned for \(day.displayName.lowercased())s.")
                        .foregroundStyle(.secondary)
                }
            }

            ForEach(slots, id: \.slotIndex) { slot in
                Section {
                    ForEach(sortedOptions(slot.options)) { option in
                        NavigationLink(value: option) {
                            MealsOptionRow(option: option)
                        }
                    }
                } header: {
                    MealsSlotHeader(slot: slot)
                }
            }

            Section("This week") {
                NavigationLink {
                    MealsGroceryListView()
                } label: {
                    LabeledContent {
                        Text(groceryStatus(menu))
                            .monospacedDigit()
                            .contentTransition(.numericText())
                    } label: {
                        Label("Grocery list", systemImage: "cart")
                    }
                }
            }

            if !menu.prepTips.isEmpty {
                Section("Prep tips") {
                    ForEach(Array(menu.prepTips.enumerated()), id: \.offset) { _, tip in
                        Text(tip)
                            .font(.subheadline)
                    }
                }
            }

            if !menu.coachNote.isEmpty {
                Section(menu.source == .fallback ? "About this menu" : "Coach note") {
                    Text(menu.coachNote)
                        .font(.subheadline)
                }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .refreshable { await meals.load() }
        .animation(Theme.spring, value: day)
        .animation(Theme.spring, value: meals.isCoachWriting)
    }

    /// Home-cooked options first, then grab-and-go, keeping the coach's order within each.
    private func sortedOptions(_ options: [MealOption]) -> [MealOption] {
        options.filter { $0.kind == .home } + options.filter { $0.kind == .out }
    }

    private func groceryStatus(_ menu: MealMenu) -> String {
        let items = menu.groceryList
        guard !items.isEmpty else { return "Empty" }
        let left = items.filter { !meals.isChecked($0) }
        if left.isEmpty { return "All set" }
        let cost = left.reduce(0) { $0 + $1.costUsd }
        return "\(left.count) left · \(Fmt.usd(cost))"
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button {
                    isRegenerateSheetPresented = true
                } label: {
                    Label("New menu…", systemImage: "arrow.clockwise")
                }
                .disabled(meals.isCoachWriting)
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

// MARK: - Rows

/// Section header for a meal slot: its name, role and macro targets.
private struct MealsSlotHeader: View {
    var slot: MenuSlot

    /// Hides the role when the label already says it ("Pre-workout" / pre-workout).
    private var roleName: String? {
        guard let name = slot.role.displayName,
              !slot.label.localizedCaseInsensitiveContains(name) else { return nil }
        return name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(slot.label)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.primary)
                if let roleName {
                    Tag(text: roleName, tint: .accentColor)
                }
            }
            MacroLine(macros: slot.targets)
                .foregroundStyle(.secondary)
        }
        .textCase(nil)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// One meal option: what it is, where to get it, and its calories, protein, time and cost.
private struct MealsOptionRow: View {
    var option: MealOption

    private var isHome: Bool { option.kind == .home }
    private var tint: Color { isHome ? Theme.protein : Theme.carbs }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: isHome ? "frying.pan.fill" : "bag.fill")
                .font(.footnote)
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.14), in: .circle)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(option.name)
                    .font(.body.weight(.medium))
                if !isHome, let place = option.place, !place.isEmpty {
                    Text(place)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                stats
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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

/// Shown above the menu while the coach writes a new one.
private struct MealsWritingRow: View {
    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
            VStack(alignment: .leading, spacing: 2) {
                Text("Writing a new menu")
                    .font(.subheadline.weight(.semibold))
                Text("This one stays until it's ready.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Regenerate

/// Optional note for the coach before it writes a new menu.
private struct MealsRegenerateSheet: View {
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
                    Text("Optional. For example: more fish, cheaper lunches, no eggs.")
                }
            }
            .navigationTitle("New menu")
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
