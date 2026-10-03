import SwiftUI

/// This week's groceries by store section, with check-offs saved on the device per menu.
struct MealsGroceryListView: View {
    @Environment(MealsStore.self) private var meals

    var body: some View {
        Group {
            if let menu = meals.menu, !menu.groceryList.isEmpty {
                list(menu.groceryList)
            } else {
                ContentUnavailableView("No groceries", systemImage: "cart", description: Text("This week's menu doesn't need any."))
            }
        }
        .navigationTitle("Grocery list")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Uncheck all") {
                    withAnimation(Theme.snappy) { meals.uncheckAllGroceries() }
                }
                .disabled(meals.checkedGroceries.isEmpty)
            }
        }
    }

    private func list(_ items: [GroceryItem]) -> some View {
        let total = items.reduce(0) { $0 + $1.costUsd }
        let left = items.filter { !meals.isChecked($0) }
        let remaining = left.reduce(0) { $0 + $1.costUsd }

        return List {
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
                    }
                    .monospacedDigit()
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .combine)
            }

            ForEach(sections(items), id: \.name) { section in
                Section(section.name) {
                    ForEach(section.items, id: \.item) { item in
                        MealsGroceryRow(item: item, isChecked: meals.isChecked(item)) {
                            withAnimation(Theme.snappy) { meals.toggle(item) }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .animation(Theme.spring, value: meals.checkedGroceries)
    }

    /// Sections in the order the coach listed them.
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

private struct MealsGroceryRow: View {
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
                        .foregroundStyle(isChecked ? .secondary : .primary)
                    Text(item.quantity)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Text(Fmt.usd(item.costUsd))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isChecked)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.item), \(item.quantity)")
        .accessibilityValue(Fmt.usd(item.costUsd))
        .accessibilityAddTraits(isChecked ? [.isButton, .isSelected] : .isButton)
    }
}
