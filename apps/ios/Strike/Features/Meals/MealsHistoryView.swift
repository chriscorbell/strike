import SwiftUI

/// The last two weeks of eating: per day, calories and protein against target and what was logged.
struct MealsHistoryView: View {
    @Environment(MealsStore.self) private var meals

    var body: some View {
        Group {
            if let days = meals.history {
                if days.isEmpty {
                    ContentUnavailableView("No meals logged", systemImage: "fork.knife", description: Text("Meals you log on Today show up here."))
                } else {
                    list(days)
                }
            } else if let error = meals.historyError {
                LoadErrorView(message: error) { await meals.loadHistory() }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Meal history")
        .task { await meals.loadHistory() }
    }

    private func list(_ days: [MealHistoryDay]) -> some View {
        List {
            ForEach(days, id: \.date) { day in
                Section {
                    VStack(spacing: 12) {
                        MacroBar(label: "Calories", value: day.consumed.kcal, target: day.targets.kcal, color: Theme.kcal, unit: " kcal")
                        MacroBar(label: "Protein", value: day.consumed.proteinG, target: day.targets.proteinG, color: Theme.protein)
                    }
                    .padding(.vertical, 6)

                    if day.logs.isEmpty {
                        Text("Nothing logged")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(day.logs) { log in
                            MealsHistoryLogRow(log: log)
                        }
                    }
                } header: {
                    HStack(alignment: .firstTextBaseline) {
                        Text(Dates.relative(day.date))
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Spacer()
                        Text(day.dayType.displayName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .textCase(nil)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isHeader)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await meals.loadHistory() }
    }
}

private struct MealsHistoryLogRow: View {
    var log: MealLog

    private var time: String? {
        Dates.timestamp(log.loggedAt)?.formatted(date: .omitted, time: .shortened)
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(log.name)
                    .font(.body)
                    .foregroundStyle(log.status == .skipped ? .secondary : .primary)
                if log.status == .eaten {
                    MacroLine(macros: log.macros)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if log.status == .skipped {
                Tag(text: "Skipped")
            } else if let time {
                Text(time)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
