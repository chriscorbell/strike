import SwiftUI

/// "Something else": pick a meal entered before, describe what you ate and let the coach estimate it, or enter the macros.
struct LogMealSheet: View {
    /// Nil logs a meal outside the plan's slots.
    var slotIndex: Int?
    var title: String

    @Environment(TodayStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private enum Mode: CaseIterable, Identifiable {
        case recent, describe, macros
        var id: Self { self }
    }

    /// Past this many recent meals, a search field filters them.
    private static let searchFrom = 7

    /// Nil until chosen: past meals when there are any, otherwise describing.
    @State private var chosenMode: Mode?
    @State private var search = ""
    @State private var fromRecent = false
    @State private var description = ""
    @State private var estimating = false
    @State private var estimateError: String?
    @State private var estimated = false

    @State private var name = ""
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var saving = false
    @FocusState private var focused: Bool

    private var recent: [RecentMeal] { store.recentMeals }

    private var mode: Mode { chosenMode ?? (recent.isEmpty ? .describe : .recent) }

    private var modes: [Mode] { recent.isEmpty ? [.describe, .macros] : Mode.allCases }

    private func label(_ mode: Mode) -> String {
        switch mode {
        case .recent: "Recent"
        case .describe: "Describe it"
        case .macros: recent.isEmpty ? "Enter macros" : "Macros"
        }
    }

    private var matches: [RecentMeal] {
        let query = search.trimmingCharacters(in: .whitespaces)
        return query.isEmpty ? recent : recent.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    /// The macro form is on screen, so there's something to log.
    private var showsForm: Bool { mode == .macros || (mode == .describe && estimated) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Mode", selection: Binding(get: { mode }, set: { chosenMode = $0 })) {
                        ForEach(modes) { Text(label($0)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                if mode == .recent {
                    if recent.count >= Self.searchFrom {
                        Section {
                            Label {
                                TextField("Search past meals", text: $search)
                                    .autocorrectionDisabled()
                            } icon: {
                                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                            }
                        }
                    }
                    Section {
                        ForEach(matches) { meal in
                            Button { pick(meal) } label: { RecentMealRow(meal: meal) }
                        }
                    } footer: {
                        if matches.isEmpty {
                            Text("Nothing matches “\(search.trimmingCharacters(in: .whitespaces))”")
                        }
                    }
                } else if mode == .describe && !estimated {
                    Section {
                        TextField("e.g. Chipotle chicken bowl, white rice, black beans, no cheese", text: $description, axis: .vertical)
                            .lineLimit(3 ... 6)
                            .focused($focused)
                    } footer: {
                        if let estimateError {
                            Text(estimateError).foregroundStyle(.orange)
                        } else {
                            Text("The coach estimates calories and macros. You can adjust them before logging.")
                        }
                    }
                    Section {
                        Button {
                            Task { await estimate() }
                        } label: {
                            HStack {
                                Spacer()
                                if estimating {
                                    ProgressView()
                                    Text("Estimating…").padding(.leading, 6)
                                } else {
                                    Label("Estimate", systemImage: "sparkles")
                                }
                                Spacer()
                            }
                            .font(.headline)
                        }
                        .disabled(estimating || description.trimmingCharacters(in: .whitespacesAndNewlines).count < 3)
                    }
                } else {
                    Section {
                        TextField("Name", text: $name)
                        macroField("Calories", text: $kcal, unit: "kcal")
                        macroField("Protein", text: $protein, unit: "g", color: Theme.protein)
                        macroField("Carbs", text: $carbs, unit: "g", color: Theme.carbs)
                        macroField("Fat", text: $fat, unit: "g", color: Theme.fat)
                    } header: {
                        Text(estimated ? "Estimate" : "Meal")
                    } footer: {
                        if kcal.isEmpty, computedKcal > 0 {
                            Text("Calories from macros: \(Fmt.integer(computedKcal)) kcal")
                        } else if fromRecent {
                            Text("Same as last time. Change anything that's different.")
                        }
                    }
                    if estimated {
                        Section {
                            Button("Describe it differently") {
                                withAnimation { estimated = false }
                            }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                if showsForm {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task { await save() }
                        } label: {
                            if saving { ProgressView() } else { Text("Log") }
                        }
                        .disabled(!canSave || saving)
                    }
                }
            }
            .animation(Theme.spring, value: mode)
            .animation(Theme.spring, value: estimated)
            .onAppear { focused = mode == .describe }
        }
        .presentationDetents([.medium, .large])
    }

    private func macroField(_ label: String, text: Binding<String>, unit: String, color: Color = .primary) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(color == .primary ? Color.primary : color)
            Spacer()
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .frame(maxWidth: 100)
            Text(unit)
                .foregroundStyle(.secondary)
                .frame(width: 34, alignment: .leading)
        }
    }

    private func number(_ text: String) -> Double? {
        Double(text.replacingOccurrences(of: ",", with: "."))
    }

    private var computedKcal: Double {
        4 * (number(protein) ?? 0) + 4 * (number(carbs) ?? 0) + 9 * (number(fat) ?? 0)
    }

    private var macros: Macros {
        Macros(
            kcal: number(kcal) ?? computedKcal,
            proteinG: number(protein) ?? 0,
            carbsG: number(carbs) ?? 0,
            fatG: number(fat) ?? 0
        )
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && macros.kcal > 0
    }

    private func estimate() async {
        focused = false
        estimating = true
        estimateError = nil
        defer { estimating = false }
        do {
            let result = try await store.estimate(description.trimmingCharacters(in: .whitespacesAndNewlines))
            fill(name: result.name, macros: result.macros)
            fromRecent = false
            withAnimation { estimated = true }
        } catch {
            estimateError = error.localizedDescription
        }
    }

    private func fill(name: String, macros: Macros) {
        self.name = name
        kcal = Fmt.integer(macros.kcal).replacingOccurrences(of: ",", with: "")
        protein = Fmt.integer(macros.proteinG)
        carbs = Fmt.integer(macros.carbsG)
        fat = Fmt.integer(macros.fatG)
    }

    private func pick(_ meal: RecentMeal) {
        fill(name: meal.name, macros: meal.macros)
        fromRecent = true
        estimated = false
        withAnimation { chosenMode = .macros }
    }

    private func save() async {
        saving = true
        await store.logCustom(name: name.trimmingCharacters(in: .whitespaces), macros: macros, slotIndex: slotIndex)
        saving = false
        dismiss()
    }
}


/// A meal entered before: name, macros and the last day it was eaten.
private struct RecentMealRow: View {
    var meal: RecentMeal

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(meal.name)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                MacroLine(macros: meal.macros)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(Dates.relative(meal.lastDate))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}
