import SwiftUI

// MARK: - Plan

/// The week's plan, one section per day, each meal showing its planned dish.
struct MealsPlanSections: View {
    var menu: MealMenu
    var week: MenuWeek
    var onSelect: (PlanSlotRef) -> Void

    @Environment(MealsStore.self) private var meals

    var body: some View {
        ForEach(menu.plan, id: \.date) { day in
            Section {
                ForEach(day.meals.sorted { $0.slotIndex < $1.slotIndex }, id: \.slotIndex) { meal in
                    let ref = PlanSlotRef(week: week, date: day.date, dayType: day.dayType, slotIndex: meal.slotIndex)
                    let slot = meals.slot(in: menu, dayType: day.dayType, slotIndex: meal.slotIndex)
                    Button {
                        onSelect(ref)
                    } label: {
                        PlanMealRow(
                            label: slot?.label ?? "Meal \(meal.slotIndex + 1)",
                            option: meals.option(in: menu, id: meal.optionId),
                            isBusy: meals.planning.contains(ref)
                        )
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(dayTitle(day.date))
                        .font(.headline)
                        .foregroundStyle(Color.primary)
                    Text(day.dayType.shortName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(day.dayType == .training ? Color.accentColor : Theme.protein)
                    Spacer()
                }
                .textCase(nil)
                .accessibilityAddTraits(.isHeader)
            }
        }
    }
}

/// "Tomorrow, Oct 4" or "Monday, Oct 5".
func dayTitle(_ date: LocalDate) -> String {
    let relative = Dates.relative(date)
    if relative == "Today" || relative == "Tomorrow" { return "\(relative), \(Dates.short(date))" }
    let weekday = Dates.weekday(of: date).map { Dates.weekdays[$0] } ?? ""
    return "\(weekday), \(Dates.short(date))"
}

private struct PlanMealRow: View {
    var label: String
    var option: MealOption?
    var isBusy: Bool

    var body: some View {
        HStack(spacing: 12) {
            MealKindIcon(kind: option?.kind ?? .home)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.secondary)
                Text(option?.name ?? "Not planned")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.primary)
                    .multilineTextAlignment(.leading)
                if let option {
                    Text(detail(option))
                        .font(.footnote)
                        .foregroundStyle(Color.secondary)
                        .monospacedDigit()
                }
            }
            Spacer(minLength: 8)
            if isBusy {
                ProgressView()
            } else {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows other options for this meal")
    }

    private func detail(_ option: MealOption) -> String {
        var parts = ["\(Fmt.kcal(option.macros.kcal))", "\(Fmt.integer(option.macros.proteinG))g protein"]
        if option.kind == .out {
            if let place = option.place, !place.isEmpty { parts.append(place) }
            parts.append("no groceries")
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Swap

/// Another dish for one planned meal: the slot's home options, grab-and-go, or new suggestions.
struct PlanSwapSheet: View {
    var ref: PlanSlotRef

    @Environment(MealsStore.self) private var meals
    @Environment(\.dismiss) private var dismiss
    @State private var detail: MealOption?

    private var menu: MealMenu? { meals.menu(for: ref.week) }
    private var slot: MenuSlot? { menu.flatMap { meals.slot(in: $0, dayType: ref.dayType, slotIndex: ref.slotIndex) } }
    private var plannedId: String? {
        menu?.plan.first { $0.date == ref.date }?.meals.first { $0.slotIndex == ref.slotIndex }?.optionId
    }

    var body: some View {
        NavigationStack {
            List {
                if let slot {
                    Section {
                        MacroLine(macros: slot.targets)
                            .foregroundStyle(.secondary)
                    } header: {
                        Text("Target")
                    }
                    let home = slot.options.filter { $0.kind == .home }
                    let out = slot.options.filter { $0.kind == .out }
                    if !home.isEmpty {
                        Section("Cook at home") {
                            ForEach(home) { row($0) }
                        }
                    }
                    if !out.isEmpty {
                        Section {
                            ForEach(out) { row($0) }
                        } header: {
                            Text("Grab and go")
                        } footer: {
                            Text("No groceries needed.")
                        }
                    }
                    Section {
                        Button {
                            Task { await meals.suggestMore(for: ref) }
                        } label: {
                            HStack(spacing: 8) {
                                if meals.suggesting.contains(ref) {
                                    ProgressView()
                                    Text("Finding more options…")
                                } else {
                                    Image(systemName: "sparkles")
                                    Text("Suggest more")
                                }
                            }
                        }
                        .disabled(meals.suggesting.contains(ref))
                    }
                }
            }
            .navigationTitle(slot?.label ?? "Meal")
            .navigationSubtitle(dayTitle(ref.date))
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $detail) { option in
                MealOptionDetailView(option: option, logTitle: option.id == plannedId ? "Planned" : "Plan this") {
                    if await meals.plan(ref, optionId: option.id) { dismiss() }
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
            }
            .animation(Theme.spring, value: slot?.options.count)
        }
        .presentationDetents([.medium, .large])
    }

    private func row(_ option: MealOption) -> some View {
        let planned = option.id == plannedId
        let busy = meals.planning.contains(ref)
        return HStack(spacing: 8) {
            Button {
                guard !planned else { return dismiss() }
                Task {
                    if await meals.plan(ref, optionId: option.id) { dismiss() }
                }
            } label: {
                HStack {
                    MealsOptionRow(option: option)
                    Spacer(minLength: 8)
                    if planned {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.tint)
                            .accessibilityLabel("Planned")
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .disabled(busy)

            Button {
                detail = option
            } label: {
                Image(systemName: "info.circle")
                    .font(.title3)
                    .frame(width: 36, height: 44)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Details for \(option.name)")
        }
        .sensoryFeedback(.selection, trigger: plannedId)
    }
}

// MARK: - Groceries

/// The grocery list for a week's plan: what to buy by store section, then staples to check.
struct MealsGrocerySections: View {
    var menu: MealMenu

    @Environment(MealsStore.self) private var meals

    var body: some View {
        let items = menu.groceryList.filter { !$0.staple }
        let staples = menu.groceryList.filter(\.staple)
        let left = items.filter { !meals.isChecked($0, menuId: menu.id) }
        let total = items.reduce(0) { $0 + $1.costUsd }
        let remaining = left.reduce(0) { $0 + $1.costUsd }

        if menu.groceryList.isEmpty {
            Section {
                ContentUnavailableView("No groceries", systemImage: "cart", description: Text("This plan doesn't need any shopping."))
            }
            .listRowBackground(Color.clear)
        } else {
            Section {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Left to buy")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(Fmt.usd(remaining))
                            .font(.number(.title, weight: .bold))
                            .contentTransition(.numericText(value: remaining))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(items.count - left.count) of \(items.count) items")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .contentTransition(.numericText())
                        Text("Total \(Fmt.usd(total))")
                            .font(.subheadline.weight(.medium))
                            .contentTransition(.numericText(value: total))
                    }
                    .monospacedDigit()
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .combine)
            }

            ForEach(sections(items), id: \.name) { section in
                Section(section.name) {
                    ForEach(section.items, id: \.item) { item in
                        GroceryRow(item: item, isChecked: meals.isChecked(item, menuId: menu.id)) {
                            withAnimation(Theme.snappy) { meals.toggle(item, menuId: menu.id) }
                        }
                    }
                }
            }

            if !staples.isEmpty {
                Section {
                    ForEach(staples, id: \.item) { item in
                        GroceryRow(item: item, isChecked: meals.isChecked(item, menuId: menu.id)) {
                            withAnimation(Theme.snappy) { meals.toggle(item, menuId: menu.id) }
                        }
                    }
                } header: {
                    Text("Check you have these")
                } footer: {
                    Text("Pantry staples, not counted in the total.")
                }
            }
        }
    }

    /// Sections in the order the server listed them.
    private func sections(_ items: [GroceryItem]) -> [(name: String, items: [GroceryItem])] {
        var order: [String] = []
        var grouped: [String: [GroceryItem]] = [:]
        for item in items {
            let name = item.section.isEmpty ? "Other" : item.section
            if grouped[name] == nil { order.append(name) }
            grouped[name, default: []].append(item)
        }
        return order.map { ($0, grouped[$0] ?? []) }
    }
}

private struct GroceryRow: View {
    var item: GroceryItem
    var isChecked: Bool
    var toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isChecked ? Color.accentColor : Color.secondary)
                    .contentTransition(.symbolEffect(.replace))
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.item.prefix(1).uppercased() + item.item.dropFirst())
                        .strikethrough(isChecked, color: .secondary)
                        .foregroundStyle(isChecked ? Color.secondary : Color.primary)
                    Text(item.quantity)
                        .font(.subheadline)
                        .foregroundStyle(Color.secondary)
                    if let needed = item.needed, !needed.isEmpty {
                        Text("Plan uses \(needed)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer(minLength: 8)
                if !item.staple {
                    Text(Fmt.usd(item.costUsd))
                        .font(.subheadline)
                        .foregroundStyle(Color.secondary)
                        .monospacedDigit()
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isChecked)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.item), buy \(item.quantity)")
        .accessibilityValue(item.staple ? "" : Fmt.usd(item.costUsd))
        .accessibilityAddTraits(isChecked ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Prep

/// The week's prep guide: cooking sessions to open in cook mode, reminders, reheating and food
/// safety. Older menus without a guide show their prep tips.
struct MealsPrepSections: View {
    var menu: MealMenu

    @Environment(MealsStore.self) private var meals
    @Environment(AppModel.self) private var app

    var body: some View {
        if let guide = menu.prepGuide {
            if !guide.overview.isEmpty {
                Section {
                    Text(guide.overview)
                        .font(.body)
                }
            }
            if menu.prepGuideStale {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("You changed the plan after this guide was written", systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.warning)
                        writeButton(title: "Update guide")
                    }
                    .padding(.vertical, 4)
                }
            }
            if !guide.sessions.isEmpty {
                Section("Cook") {
                    ForEach(Array(guide.sessions.enumerated()), id: \.offset) { index, session in
                        NavigationLink(value: CookRoute(menuId: menu.id, session: index)) {
                            PrepSessionRow(
                                session: session,
                                progress: meals.cookProgress(CookKey(menuId: menu.id, session: index, version: guide.createdAt))
                            )
                        }
                    }
                }
            }
            let today = app.today.data?.date ?? Dates.today
            let reminders = guide.reminders.filter { $0.date >= today }
            if !reminders.isEmpty {
                Section("Reminders") {
                    ForEach(Array(reminders.enumerated()), id: \.offset) { _, reminder in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(dayTitle(reminder.date))\(reminder.time.map { " · \(Dates.display($0))" } ?? "")")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(reminder.text)
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            if !guide.reheating.isEmpty {
                Section("Reheating") {
                    ForEach(Array(guide.reheating.enumerated()), id: \.offset) { _, item in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.dish)
                                .font(.body.weight(.semibold))
                            Text(item.instructions)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            if !guide.foodSafety.isEmpty {
                Section("Food safety") {
                    ForEach(Array(guide.foodSafety.enumerated()), id: \.offset) { _, rule in
                        Label {
                            Text(rule)
                                .font(.subheadline)
                        } icon: {
                            Image(systemName: "checkmark.shield")
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
        } else {
            if !menu.plan.isEmpty {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("A step-by-step guide to cook and pack the week's meals, with timers and containers.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        writeButton(title: "Write prep guide")
                    }
                    .padding(.vertical, 4)
                }
            }
            cookList
            if !menu.prepTips.isEmpty {
                Section("Prep tips") {
                    ForEach(Array(menu.prepTips.enumerated()), id: \.offset) { _, tip in
                        Text(tip)
                            .font(.subheadline)
                    }
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

    @ViewBuilder
    private func writeButton(title: String) -> some View {
        if meals.isWritingGuide(menu) {
            HStack(spacing: 10) {
                ProgressView()
                Text("Writing your prep guide…")
                    .font(.subheadline.weight(.medium))
            }
            .frame(minHeight: 34)
        } else {
            Button {
                Task { await meals.writePrepGuide(for: menu) }
            } label: {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.glassProminent)
        }
    }

    /// Without a guide: each home dish in the plan and how many meals it covers.
    @ViewBuilder
    private var cookList: some View {
        let entries = cookEntries
        if !entries.isEmpty {
            Section("Cook this week") {
                ForEach(entries, id: \.option.id) { entry in
                    NavigationLink(value: entry.option) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.option.name)
                                    .font(.body.weight(.medium))
                                if entry.option.prepMinutes > 0 {
                                    Text(Fmt.minutes(entry.option.prepMinutes))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text(entry.count == 1 ? "1 meal" : "\(entry.count) meals")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                    }
                }
            }
        }
    }

    private var cookEntries: [(option: MealOption, count: Int)] {
        var counts: [String: Int] = [:]
        var order: [String] = []
        for day in menu.plan {
            for meal in day.meals {
                if counts[meal.optionId] == nil { order.append(meal.optionId) }
                counts[meal.optionId, default: 0] += 1
            }
        }
        return order.compactMap { id in
            guard let option = meals.option(in: menu, id: id), option.kind == .home else { return nil }
            return (option, counts[id] ?? 0)
        }
        .sorted { $0.count > $1.count }
    }
}

/// A cooking session in the Prep list: when, what it covers, how long, and how far along.
struct PrepSessionRow: View {
    var session: PrepSession
    var progress: CookProgress

    var body: some View {
        let total = session.steps.count
        let done = progress.steps.count
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(session.title)
                        .font(.headline)
                    Spacer(minLength: 8)
                    if total > 0 && done == total {
                        Label("Done", systemImage: "checkmark.circle.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.green)
                    } else if done > 0 {
                        Text("\(done) of \(total) steps")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.tint)
                            .monospacedDigit()
                    }
                }
                Text("\(dayTitle(session.date)) · \(session.covers)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("\(Fmt.minutes(Double(session.activeMinutes))) hands-on · \(Fmt.minutes(Double(session.totalMinutes))) total")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
