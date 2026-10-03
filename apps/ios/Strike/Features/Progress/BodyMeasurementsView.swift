import SwiftUI

/// Tape measurements and body fat: the latest values with their change, then earlier entries.
struct BodyMeasurementsView: View {
    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress
    @State private var isAdding = false

    /// The tape measurements, in display order.
    enum Field: CaseIterable, Identifiable {
        case waist, neck, hips, chest, arm, thigh

        var id: Self { self }

        var label: String {
            switch self {
            case .waist: "Waist"
            case .neck: "Neck"
            case .hips: "Hips"
            case .chest: "Chest"
            case .arm: "Arm"
            case .thigh: "Thigh"
            }
        }

        func cm(in m: Measurements) -> Double? {
            switch self {
            case .waist: m.waistCm
            case .neck: m.neckCm
            case .hips: m.hipsCm
            case .chest: m.chestCm
            case .arm: m.armCm
            case .thigh: m.thighCm
            }
        }

        func set(_ cm: Double?, in m: inout Measurements) {
            switch self {
            case .waist: m.waistCm = cm
            case .neck: m.neckCm = cm
            case .hips: m.hipsCm = cm
            case .chest: m.chestCm = cm
            case .arm: m.armCm = cm
            case .thigh: m.thighCm = cm
            }
        }
    }

    var body: some View {
        Group {
            if let entries = progress.measurements {
                if entries.isEmpty {
                    ContentUnavailableView {
                        Label("No measurements", systemImage: "ruler")
                    } description: {
                        Text("Add your first tape measurements.")
                    } actions: {
                        Button("Add measurements") { isAdding = true }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    list(entries)
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Measurements")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add measurements", systemImage: "plus") { isAdding = true }
            }
        }
        .sheet(isPresented: $isAdding) {
            BodyMeasurementEditor(units: app.units, previous: progress.measurements?.first)
        }
        .task { await progress.loadMeasurements() }
    }

    private func list(_ entries: [MeasurementEntry]) -> some View {
        let units = app.units
        let latest = entries[0]
        let earlier = Array(entries.dropFirst())

        return List {
            Section {
                ForEach(Field.allCases) { field in
                    if let cm = field.cm(in: latest.measurements) {
                        let before = earlier.lazy.compactMap { field.cm(in: $0.measurements) }.first
                        valueRow(
                            field.label,
                            value: units.formatLength(cm: cm),
                            change: before.map { units.length(fromCm: cm) - units.length(fromCm: $0) },
                            unit: units.lengthSymbol
                        )
                    }
                }
                if let fat = latest.bodyFatPercent {
                    let before = earlier.lazy.compactMap(\.bodyFatPercent).first
                    valueRow("Body fat", value: "\(Fmt.number(fat))%", change: before.map { fat - $0 }, unit: "%")
                }
            } header: {
                Text("Latest · \(Dates.medium(latest.date))")
            }

            if !earlier.isEmpty {
                Section("Earlier") {
                    ForEach(earlier) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Dates.medium(entry.date))
                                .font(.body.weight(.medium))
                            Text(summary(entry, units: units))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                        .swipeActions {
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                Task { await progress.deleteMeasurement(entry) }
                            }
                        }
                    }
                }
            }
            Section {
                Button("Delete latest entry", role: .destructive) {
                    Task { await progress.deleteMeasurement(latest) }
                }
            } footer: {
                Text("One entry per day; saving the same date again replaces it.")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await progress.loadMeasurements() }
    }

    private func valueRow(_ label: String, value: String, change: Double?, unit: String) -> some View {
        LabeledContent {
            HStack(spacing: 10) {
                if let change, abs(change) >= 0.05 {
                    Text("\(Fmt.signed(change))\(unit == "%" ? "" : " ")\(unit)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Text(value)
                    .foregroundStyle(.primary)
            }
            .monospacedDigit()
        } label: {
            Text(label)
        }
    }

    private func summary(_ entry: MeasurementEntry, units: UnitSystem) -> String {
        var parts = Field.allCases.compactMap { field in
            field.cm(in: entry.measurements).map { "\(field.label) \(units.formatLength(cm: $0))" }
        }
        if let fat = entry.bodyFatPercent {
            parts.append("Body fat \(Fmt.number(fat))%")
        }
        return parts.joined(separator: " · ")
    }
}

/// New measurements for a day. Every field is optional.
struct BodyMeasurementEditor: View {
    var units: UnitSystem
    /// The most recent entry, whose values serve as placeholders.
    var previous: MeasurementEntry?

    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date.now
    @State private var tape: [BodyMeasurementsView.Field: String] = [:]
    @State private var bodyFat = ""
    @State private var isSaving = false
    @State private var saved = false

    private static let validBodyFat = 3.0 ... 60.0

    private func parse(_ text: String) -> Double? {
        let cleaned = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        return cleaned.isEmpty ? nil : Double(cleaned)
    }

    /// The form as wire values, or nil when something typed isn't a valid number.
    private var measurements: Measurements? {
        var m = Measurements()
        for field in BodyMeasurementsView.Field.allCases {
            let text = tape[field] ?? ""
            guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            guard let value = parse(text), value > 0 else { return nil }
            field.set(units.cm(fromLength: value), in: &m)
        }
        if !bodyFat.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let fat = parse(bodyFat), Self.validBodyFat.contains(fat) else { return nil }
            m.bodyFatPercent = fat
        }
        return m
    }

    private var canSave: Bool {
        guard let measurements else { return false }
        return !measurements.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                }

                Section("Tape measure") {
                    ForEach(BodyMeasurementsView.Field.allCases) { field in
                        numberRow(
                            field.label,
                            text: binding(for: field),
                            placeholder: previous.flatMap { field.cm(in: $0.measurements) }.map { Fmt.number(units.length(fromCm: $0)) },
                            unit: units.lengthSymbol
                        )
                    }
                }

                Section {
                    numberRow("Body fat", text: $bodyFat, placeholder: nil, unit: "%")
                } footer: {
                    Text("Leave blank to estimate it from waist and neck.")
                }
            }
            .navigationTitle("Add measurements")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save", role: .confirm, action: save)
                            .disabled(!canSave)
                    }
                }
            }
        }
        .sensoryFeedback(.success, trigger: saved)
    }

    private func binding(for field: BodyMeasurementsView.Field) -> Binding<String> {
        Binding(
            get: { tape[field] ?? "" },
            set: { tape[field] = $0 }
        )
    }

    private func numberRow(_ label: String, text: Binding<String>, placeholder: String?, unit: String) -> some View {
        HStack {
            Text(label)
            Spacer(minLength: 12)
            TextField(placeholder ?? "—", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .accessibilityLabel("\(label) in \(unit == "%" ? "percent" : unit)")
            Text(unit)
                .foregroundStyle(.secondary)
                .frame(minWidth: 22, alignment: .leading)
        }
    }

    private func save() {
        guard let measurements, !measurements.isEmpty else { return }
        isSaving = true
        let request = MeasurementRequest(date: Dates.localDate(from: date), measurements: measurements)
        Task {
            let entry = await progress.saveMeasurement(request)
            isSaving = false
            guard let entry else { return }
            saved = true
            if measurements.bodyFatPercent == nil, let fat = entry.bodyFatPercent {
                app.show(Toast(message: "Body fat estimated at \(Fmt.number(fat))%", style: .success))
            }
            dismiss()
        }
    }
}
