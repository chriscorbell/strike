import SwiftUI

/// Every weigh-in, newest first, grouped by month. Tap to edit, swipe to delete, + to add.
struct BodyWeighInsView: View {
    /// Opens the add sheet on arrival, for the "Log weight" shortcut.
    var startsAdding = false

    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress
    @State private var editor: BodyWeighInEditor.Mode?
    @State private var didStartAdding = false

    var body: some View {
        Group {
            if let weighIns = progress.weighIns {
                if weighIns.isEmpty {
                    ContentUnavailableView {
                        Label("No weigh-ins", systemImage: "scalemass")
                    } description: {
                        Text("Add one to start your trend.")
                    } actions: {
                        Button("Add weigh-in") { editor = .add }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    list(weighIns)
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Weigh-ins")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add weigh-in", systemImage: "plus") { editor = .add }
            }
        }
        .sheet(item: $editor) { mode in
            BodyWeighInEditor(mode: mode, units: app.units, recentKg: progress.weighIns?.first?.weightKg)
        }
        .task {
            await progress.loadWeighIns()
            if startsAdding, !didStartAdding {
                didStartAdding = true
                editor = .add
            }
        }
    }

    private func list(_ weighIns: [WeightPoint]) -> some View {
        List {
            ForEach(months(weighIns), id: \.key) { month in
                Section(month.title) {
                    ForEach(month.points, id: \.date) { point in
                        row(point, previous: previous(of: point, in: weighIns))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await progress.loadWeighIns() }
    }

    private func row(_ point: WeightPoint, previous: WeightPoint?) -> some View {
        let change: Double? = {
            guard let kg = point.weightKg, let before = previous?.weightKg else { return nil }
            return app.units.weight(fromKg: kg) - app.units.weight(fromKg: before)
        }()

        return Button {
            editor = .edit(point)
        } label: {
            HStack(alignment: .firstTextBaseline) {
                Text(Dates.relative(point.date))
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                if let change {
                    Text(Fmt.signed(change))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Change \(Fmt.signed(change)) \(app.units.weightSymbol)")
                }
                Text(app.units.formatWeight(kg: point.weightKg))
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                    .frame(minWidth: 84, alignment: .trailing)
            }
            .monospacedDigit()
            .contentShape(.rect)
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Edit")
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await progress.deleteWeight(date: point.date) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    /// The weigh-in just before this one (the list is newest first).
    private func previous(of point: WeightPoint, in weighIns: [WeightPoint]) -> WeightPoint? {
        guard let index = weighIns.firstIndex(where: { $0.date == point.date }), index + 1 < weighIns.count else { return nil }
        return weighIns[index + 1]
    }

    private func months(_ weighIns: [WeightPoint]) -> [(key: String, title: String, points: [WeightPoint])] {
        var order: [String] = []
        var grouped: [String: [WeightPoint]] = [:]
        for point in weighIns {
            let key = String(point.date.prefix(7))
            if grouped[key] == nil { order.append(key) }
            grouped[key, default: []].append(point)
        }
        return order.map { key in
            let title = Dates.date(from: "\(key)-01")?.formatted(.dateTime.month(.wide).year()) ?? key
            return (key, title, grouped[key] ?? [])
        }
    }
}

/// Add a weigh-in for any past day, or correct one.
struct BodyWeighInEditor: View {
    enum Mode: Identifiable {
        case add
        case edit(WeightPoint)

        var id: String {
            switch self {
            case .add: "add"
            case let .edit(point): point.date
            }
        }
    }

    var mode: Mode
    var units: UnitSystem
    /// The latest weigh-in, shown as the placeholder when adding.
    var recentKg: Double?

    @Environment(ProgressStore.self) private var progress
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date.now
    @State private var text = ""
    @State private var isSaving = false
    @State private var saved = false
    @FocusState private var isFocused: Bool

    private static let validKg = 30.0 ... 300.0

    private var kg: Double? {
        let cleaned = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        return Double(cleaned).map(units.kg(fromWeight:))
    }

    private var isValid: Bool { kg.map(Self.validKg.contains) ?? false }

    private var day: LocalDate {
        if case let .edit(point) = mode { return point.date }
        return Dates.localDate(from: date)
    }

    private var placeholder: String {
        let kg: Double? = if case let .edit(point) = mode { point.weightKg } else { recentKg }
        return kg.map { Fmt.number(units.weight(fromKg: $0)) } ?? "0"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if case let .edit(point) = mode {
                        LabeledContent("Date", value: Dates.long(point.date))
                    } else {
                        DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                    }
                    HStack {
                        Text("Weight")
                        Spacer(minLength: 12)
                        TextField(placeholder, text: $text)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .font(.number(.title3))
                            .focused($isFocused)
                            .accessibilityLabel("Weight in \(units.weightSymbol == "lb" ? "pounds" : "kilograms")")
                        Text(units.weightSymbol)
                            .foregroundStyle(.secondary)
                    }
                } footer: {
                    if !text.isEmpty, !isValid {
                        Text("Enter a weight between \(Fmt.integer(units.weight(fromKg: Self.validKg.lowerBound))) and \(Fmt.integer(units.weight(fromKg: Self.validKg.upperBound))) \(units.weightSymbol).")
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit weigh-in" : "Add weigh-in")
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
                            .disabled(!isValid)
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .sensoryFeedback(.success, trigger: saved)
        .onAppear {
            if case let .edit(point) = mode, let kg = point.weightKg {
                text = Fmt.number(units.weight(fromKg: kg))
            }
            isFocused = true
        }
    }

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private func save() {
        guard let kg, isValid else { return }
        isSaving = true
        Task {
            let ok = await progress.saveWeight(date: day, kg: kg)
            isSaving = false
            if ok {
                saved = true
                dismiss()
            }
        }
    }
}
