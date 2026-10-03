import SwiftUI

/// "Something else": describe what you ate and let the coach estimate it, or enter the macros.
struct LogMealSheet: View {
    /// Nil logs a meal outside the plan's slots.
    var slotIndex: Int?
    var title: String

    @Environment(TodayStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private enum Mode: String, CaseIterable, Identifiable {
        case describe = "Describe it"
        case macros = "Enter macros"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .describe
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

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                if mode == .describe && !estimated {
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
                if mode == .macros || estimated {
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
            .onAppear { focused = true }
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
            name = result.name
            kcal = Fmt.integer(result.macros.kcal).replacingOccurrences(of: ",", with: "")
            protein = Fmt.integer(result.macros.proteinG)
            carbs = Fmt.integer(result.macros.carbsG)
            fat = Fmt.integer(result.macros.fatG)
            withAnimation { estimated = true }
        } catch {
            estimateError = error.localizedDescription
        }
    }

    private func save() async {
        saving = true
        await store.logCustom(name: name.trimmingCharacters(in: .whitespaces), macros: macros, slotIndex: slotIndex)
        saving = false
        dismiss()
    }
}
