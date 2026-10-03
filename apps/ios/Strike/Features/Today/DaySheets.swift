import SwiftUI

// MARK: - Weigh-in

/// Today's weigh-in when it isn't logged yet.
struct WeighInCard: View {
    var trendKg: Double?

    @Environment(AppModel.self) private var app
    @Environment(TodayStore.self) private var store
    @State private var text = ""
    @State private var saving = false
    @State private var saved = 0
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Label("Morning weigh-in", systemImage: "scalemass.fill")
                    .font(.headline)
                    .labelStyle(TintedIconLabelStyle())
                Spacer(minLength: 8)
                if let trendKg {
                    Text("Trend \(app.units.formatWeight(kg: trendKg))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    TextField(placeholder, text: $text)
                        .keyboardType(.decimalPad)
                        .font(.number(.title3))
                        .focused($focused)
                        .accessibilityLabel("Weight in \(app.units.weightSymbol == "lb" ? "pounds" : "kilograms")")
                    Text(app.units.weightSymbol)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 14, style: .continuous))
                .onTapGesture { focused = true }

                Button {
                    Task { await save() }
                } label: {
                    Group {
                        if saving {
                            ProgressView().tint(.white)
                        } else {
                            Text("Log")
                        }
                    }
                    .font(.headline)
                    .frame(minWidth: 56, minHeight: 36)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(value == nil || saving)
            }
        }
        .card()
        .sensoryFeedback(.success, trigger: saved)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = false }
            }
        }
    }

    private var placeholder: String {
        trendKg.map { Fmt.number(app.units.weight(fromKg: $0), decimals: 1) } ?? "0.0"
    }

    private var value: Double? {
        guard let number = Double(text.replacingOccurrences(of: ",", with: ".")), number > 0 else { return nil }
        let kg = app.units.kg(fromWeight: number)
        return (30 ... 300).contains(kg) ? kg : nil
    }

    private func save() async {
        guard let kg = value else { return }
        focused = false
        saving = true
        if await store.logWeight(kg: kg) {
            saved += 1
            text = ""
        }
        saving = false
    }
}

// MARK: - Workout time

/// Moves today's workout; meal times follow on the server.
struct WorkoutTimeSheet: View {
    var current: TimeOfDay
    var hasOverride: Bool

    @Environment(TodayStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var time = Date.now
    @State private var saving = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 8) {
                DatePicker("Workout time", selection: $time, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                Text("Meal times shift to fit around it.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if hasOverride {
                    Button("Back to my usual time") {
                        Task { await save(nil) }
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.top, 8)
                }
            }
            .padding()
            .navigationTitle("Move workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save(Dates.timeOfDay(from: time)) }
                    } label: {
                        if saving { ProgressView() } else { Text("Save") }
                    }
                    .disabled(saving)
                }
            }
        }
        .presentationDetents([.height(380)])
        .onAppear { time = Dates.date(at: current) ?? .now }
    }

    private func save(_ value: TimeOfDay?) async {
        saving = true
        await store.setWorkoutTime(value)
        saving = false
        dismiss()
    }
}

// MARK: - Check-in

/// Runs this week's check-in: weight trend, calorie adjustment, adherence. The coach's note follows.
struct CheckInSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(TodayStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var note = ""
    @State private var running = false
    @State private var result: CheckIn?

    var body: some View {
        NavigationStack {
            Form {
                if let result {
                    resultSections(result)
                } else {
                    Section {
                        TextField("Anything the coach should know? (optional)", text: $note, axis: .vertical)
                            .lineLimit(3 ... 6)
                    } footer: {
                        Text("Strike looks at your weight trend, training and meals this week and adjusts your calories if needed.")
                    }
                }
            }
            .navigationTitle("Weekly check-in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(result == nil ? "Cancel" : "Done", systemImage: result == nil ? "xmark" : "checkmark") { dismiss() }
                }
                if result == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task {
                                running = true
                                let checkIn = await store.runCheckIn(note: note)
                                withAnimation(Theme.spring) { result = checkIn }
                                running = false
                                if checkIn == nil { dismiss() }
                            }
                        } label: {
                            if running { ProgressView() } else { Text("Run") }
                        }
                        .disabled(running)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private func resultSections(_ checkIn: CheckIn) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(checkIn.adjustmentKcal == 0 ? "Calories stay the same" : "\(Fmt.signed(checkIn.adjustmentKcal, decimals: 0)) kcal a day")
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                Text(checkIn.adjustmentReason)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
        }
        Section("This week") {
            ValueRow(label: "Trend weight", value: app.units.formatWeight(kg: checkIn.trendKg))
            ValueRow(label: "Rate", value: app.units.formatRate(kgPerWeek: checkIn.rateKgPerWeek))
            ValueRow(label: "Target rate", value: app.units.formatRate(kgPerWeek: checkIn.targetRateKgPerWeek))
            ValueRow(label: "Weigh-ins", value: "\(checkIn.weighIns)")
            ValueRow(label: "Sessions", value: "\(checkIn.sessionsCompleted) of \(checkIn.sessionsPlanned)")
            if let adherence = checkIn.mealAdherence {
                ValueRow(label: "Meals on plan", value: "\(Int((adherence * 100).rounded()))%")
            }
        }
        Section("Coach") {
            if let coachNote = checkIn.coachNote, !coachNote.isEmpty {
                Text(coachNote)
            } else {
                Label("The coach's note will show up in Plan shortly.", systemImage: "hourglass")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Label with the icon in the accent color and the title in the primary color.
struct TintedIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.icon
                .foregroundStyle(.tint)
            configuration.title
        }
    }
}
