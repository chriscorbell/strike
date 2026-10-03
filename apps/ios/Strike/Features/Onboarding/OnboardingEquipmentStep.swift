import SwiftUI

/// What's available at home and at the gym: dumbbells, equipment, machine stack steps and notes.
/// Loads are in the profile's load unit.
struct OnboardingEquipmentStep: View {
    @Bindable var model: OnboardingModel
    @State private var location: Location
    @State private var newWeight: Double?
    @State private var showFill = false

    init(model: OnboardingModel) {
        _model = Bindable(model)
        _location = State(initialValue: model.draft.profile.training.defaultLocation)
    }

    private var equipment: Binding<LocationEquipment> { $model.draft.profile.equipment[location] }
    private var current: LocationEquipment { model.draft.profile.equipment[location] }
    private var unit: String { model.draft.loadUnit.symbol }
    private var isDefault: Bool { model.draft.profile.training.defaultLocation == location }

    var body: some View {
        Section {
            Picker("Location", selection: $location.animation(Theme.spring)) {
                ForEach(Location.allCases) { location in
                    Text(location.displayName).tag(location)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
        }

        Section {
            Toggle(location == .home ? "I can train at home" : "I can train at the gym", isOn: equipment.available.animation(Theme.spring))
        } footer: {
            if isDefault, !current.available {
                Text("You usually train here, so it needs to be available.")
                    .foregroundStyle(Theme.warning)
            } else if isDefault {
                Text("Where you usually train.")
            }
        }

        if current.available {
            dumbbellSection

            Section {
                OnboardingChipPicker(items: EquipmentItem.allCases, selection: equipment.items) { $0.displayName }
                    .onboardingControlRow()
            } header: {
                Text("Equipment")
            }

            Section {
                OnboardingNumberField(
                    title: "Stack increment",
                    value: OnboardingBind.required(equipment.machineStep),
                    unit: unit,
                    decimals: 2
                )
            } footer: {
                Text("The smallest jump on cable and machine weight stacks.")
            }

            Section {
                TextField("Bands, kettlebells, anything else", text: equipment.notes, axis: .vertical)
                    .lineLimit(1 ... 4)
            } header: {
                Text("Notes")
            }
        }
    }

    // MARK: Dumbbells

    private var dumbbellSection: some View {
        Section {
            Picker("Dumbbells", selection: kindBinding) {
                ForEach(OnboardingDumbbellKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            switch current.dumbbells {
            case .none:
                EmptyView()
            case .adjustable:
                OnboardingNumberField(title: "Lightest", value: adjustable(.min), unit: unit, decimals: 2)
                OnboardingNumberField(title: "Heaviest", value: adjustable(.max), unit: unit, decimals: 2)
                OnboardingNumberField(title: "Increment", value: adjustable(.step), unit: unit, decimals: 2)
            case let .fixed(weights):
                fixedRows(weights.sorted())
            }
        } header: {
            Text("Dumbbells")
        } footer: {
            if case .none = current.dumbbells {
                EmptyView()
            } else {
                Text("Per dumbbell, in \(unit).")
            }
        }
    }

    @ViewBuilder
    private func fixedRows(_ weights: [Double]) -> some View {
        if weights.isEmpty {
            Text("No weights yet")
                .foregroundStyle(.secondary)
        } else {
            OnboardingFlowLayout {
                ForEach(weights, id: \.self) { weight in
                    OnboardingChip(
                        title: Fmt.number(weight, decimals: 2),
                        isSelected: false,
                        removable: true,
                        accessibilityTitle: "\(Fmt.number(weight, decimals: 2)) \(unit)"
                    ) {
                        remove(weight)
                    }
                }
            }
            .padding(.vertical, 6)
            .onboardingControlRow()
            .sensoryFeedback(.selection, trigger: weights)
        }

        HStack(spacing: 12) {
            OnboardingNumberField(title: "Add a weight", value: $newWeight, unit: unit, decimals: 2)
            Button {
                addWeight()
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title3)
            }
            .buttonStyle(.borderless)
            .disabled((newWeight ?? 0) <= 0)
            .accessibilityLabel("Add weight")
        }

        Button("Fill a range…") { showFill = true }
            .sheet(isPresented: $showFill) {
                OnboardingFillRangeSheet(unit: model.draft.loadUnit, current: weights) { filled in
                    withAnimation(Theme.spring) {
                        model.draft.profile.equipment[location].dumbbells = .fixed(weights: filled)
                    }
                }
            }
    }

    private var kindBinding: Binding<OnboardingDumbbellKind> {
        Binding {
            OnboardingDumbbellKind(model.draft.profile.equipment[location].dumbbells)
        } set: { kind in
            withAnimation(Theme.spring) { model.setDumbbellKind(kind, at: location) }
        }
    }

    private enum AdjustablePart { case min, max, step }

    private func adjustable(_ part: AdjustablePart) -> Binding<Double?> {
        let location = location
        return Binding {
            guard case let .adjustable(min, max, step) = model.draft.profile.equipment[location].dumbbells else { return nil }
            return switch part {
            case .min: min
            case .max: max
            case .step: step
            }
        } set: { value in
            guard let value, case let .adjustable(min, max, step) = model.draft.profile.equipment[location].dumbbells else { return }
            model.draft.profile.equipment[location].dumbbells = .adjustable(
                min: part == .min ? value : min,
                max: part == .max ? value : max,
                step: part == .step ? value : step
            )
        }
    }

    private func remove(_ weight: Double) {
        guard case let .fixed(weights) = current.dumbbells else { return }
        withAnimation(Theme.snappy) {
            model.draft.profile.equipment[location].dumbbells = .fixed(weights: weights.filter { $0 != weight })
        }
    }

    private func addWeight() {
        guard let weight = newWeight, weight > 0, case let .fixed(weights) = current.dumbbells else { return }
        let rounded = (weight * 100).rounded() / 100
        withAnimation(Theme.snappy) {
            model.draft.profile.equipment[location].dumbbells = .fixed(weights: Array(Set(weights + [rounded])).sorted())
            newWeight = nil
        }
    }
}

/// Replaces a fixed dumbbell list with an evenly spaced range.
private struct OnboardingFillRangeSheet: View {
    var unit: LoadUnit
    var onFill: ([Double]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var from: Double?
    @State private var to: Double?
    @State private var step: Double?

    private static let maxCount = 60

    init(unit: LoadUnit, current: [Double], onFill: @escaping ([Double]) -> Void) {
        self.unit = unit
        self.onFill = onFill
        let sorted = current.sorted()
        let lb = unit == .lb
        let gaps = zip(sorted, sorted.dropFirst()).map { $1 - $0 }.filter { $0 > 0 }
        _from = State(initialValue: sorted.first ?? (lb ? 5 : 2.5))
        _to = State(initialValue: sorted.count > 1 ? sorted.last : (lb ? 50 : 25))
        _step = State(initialValue: gaps.min() ?? (lb ? 5 : 2.5))
    }

    private var weights: [Double]? {
        guard let from, let to, let step, from > 0, step > 0, to >= from else { return nil }
        let count = Int(((to - from) / step + 1e-6).rounded(.down)) + 1
        guard count <= Self.maxCount else { return nil }
        return (0 ..< count).map { ((from + Double($0) * step) * 100).rounded() / 100 }
    }

    private var preview: String {
        guard let weights, let first = weights.first, let last = weights.last else {
            return "Pick a lightest and heaviest weight and a step, up to \(Self.maxCount) pairs."
        }
        let list = weights.count <= 6
            ? weights.map { Fmt.number($0, decimals: 2) }.joined(separator: ", ")
            : "\(Fmt.number(first, decimals: 2)), \(Fmt.number(weights[1], decimals: 2)), \(Fmt.number(weights[2], decimals: 2)) … \(Fmt.number(last, decimals: 2))"
        let pairs = weights.count == 1 ? "1 pair" : "\(weights.count) pairs"
        return "\(pairs): \(list) \(unit.symbol). Replaces the current list."
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    OnboardingNumberField(title: "Lightest", value: $from, unit: unit.symbol, decimals: 2)
                    OnboardingNumberField(title: "Heaviest", value: $to, unit: unit.symbol, decimals: 2)
                    OnboardingNumberField(title: "Step", value: $step, unit: unit.symbol, decimals: 2)
                } footer: {
                    Text(preview)
                        .monospacedDigit()
                }
            }
            .navigationTitle("Fill a range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fill", systemImage: "checkmark") {
                        guard let weights else { return }
                        onFill(weights)
                        dismiss()
                    }
                    .disabled(weights == nil)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { OnboardingKeyboard.dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
