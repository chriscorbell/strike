import SwiftUI

/// One exercise: prescription, last time, cues, and its sets. The focused set expands into the editor.
struct ExerciseCard: View {
    var store: WorkoutStore
    var exercise: SessionExercise
    var onSwap: () -> Void
    /// Opens the form guide.
    var onGuide: () -> Void

    @State private var showCues = false

    private var rows: [SessionSet] { store.rows(for: exercise) }
    private var isDone: Bool { rows.allSatisfy { $0.log != nil } }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            details
            VStack(spacing: 6) {
                ForEach(rows, id: \.index) { set in
                    let key = WorkoutStore.SetKey(exerciseId: exercise.id, index: set.index)
                    SetRow(store: store, exercise: exercise, set: set, key: key)
                        .id(SetRowID(key: key))
                }
            }
            if store.session?.status != .completed {
                HStack {
                    Button {
                        store.addSet(to: exercise)
                    } label: {
                        Label("Add set", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                            .frame(minHeight: 36)
                    }
                    .buttonStyle(.borderless)
                    if (store.rows(for: exercise).count > exercise.sets.count) {
                        Spacer()
                        Button("Remove added set", role: .destructive) {
                            store.removeAddedSet(from: exercise)
                        }
                        .font(.subheadline)
                        .buttonStyle(.borderless)
                    }
                }
            }
        }
        .card()
        .overlay(alignment: .topTrailing) {
            if isDone {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.green)
                    .padding(14)
                    .transition(.scale.combined(with: .opacity))
                    .accessibilityLabel("All sets logged")
            }
        }
        .animation(Theme.spring, value: isDone)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Button(action: onGuide) {
                    // A no-break space keeps the chevron with the last word.
                    Text("\(exercise.name)\u{00A0}\(Text(Image(systemName: "chevron.forward")).font(.subheadline.weight(.semibold)).foregroundStyle(.tertiary))")
                        .font(.title3.weight(.semibold))
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(exercise.name)
                .accessibilityHint("Shows how to do it, with a video")
                Text("\(exercise.muscle.displayName) · \(exercise.loadType.displayName) · \(exercise.repMin)–\(exercise.repMax) reps")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if !isDone {
                Menu {
                    Button("How to do it", systemImage: "play.rectangle", action: onGuide)
                    if store.canSwap(exercise) {
                        Button("Swap exercise", systemImage: "arrow.triangle.2.circlepath", action: onSwap)
                    }
                    if !exercise.cues.isEmpty {
                        Button(showCues ? "Hide cues" : "Show cues", systemImage: "text.alignleft") {
                            withAnimation(Theme.spring) { showCues.toggle() }
                        }
                    }
                    if store.session?.status != .completed {
                    Menu("Rest time", systemImage: "timer") {
                        ForEach([60.0, 90, 120, 150, 180, 240], id: \.self) { seconds in
                            Button {
                                store.restOverrides[exercise.id] = seconds
                            } label: {
                                if store.restSeconds(for: exercise) == seconds {
                                    Label(restLabel(seconds), systemImage: "checkmark")
                                } else {
                                    Text(restLabel(seconds))
                                }
                            }
                        }
                    }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .accessibilityLabel("\(exercise.name) options")
            }
        }
    }

    @ViewBuilder
    private var details: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let from = exercise.substitutedFrom, !from.isEmpty {
                Label("Swapped in for \(from)", systemImage: "arrow.triangle.2.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if !exercise.prescriptionNote.isEmpty {
                Label {
                    Text(exercise.prescriptionNote)
                } icon: {
                    Image(systemName: "scope")
                        .foregroundStyle(.tint)
                }
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            }
            if let last = exercise.lastTime, !last.sets.isEmpty {
                Label {
                    let when = Text("Last time, \(Dates.short(last.date)):").foregroundStyle(.secondary)
                    Text("\(when)  \(last.sets.map { lastSet($0) }.joined(separator: "  ·  "))")
                } icon: {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundStyle(.secondary)
                }
                .font(.footnote)
                .monospacedDigit()
            }
            if exercise.maxedOut {
                Label("You've outgrown the heaviest weight here. Add reps or slow the tempo.", systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.warning)
            }
            if showCues {
                VStack(alignment: .leading, spacing: 6) {
                    Text(exercise.cues)
                    if !exercise.notes.isEmpty {
                        Text(exercise.notes)
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.footnote)
                .transition(.opacity.combined(with: .move(edge: .top)))
            } else if !exercise.notes.isEmpty {
                Text(exercise.notes)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func lastSet(_ set: LastTimeSet) -> String {
        let reps = Int(set.reps)
        guard let weight = set.weight else { return "\(reps)" }
        return "\(Fmt.loadValue(weight))×\(reps)"
    }

    private func restLabel(_ seconds: Double) -> String {
        let s = Int(seconds)
        return s % 60 == 0 ? "\(s / 60):00" : "\(s / 60):\(String(format: "%02d", s % 60))"
    }
}

// MARK: - Set row

private struct SetRow: View {
    var store: WorkoutStore
    var exercise: SessionExercise
    var set: SessionSet
    var key: WorkoutStore.SetKey

    private var isFocused: Bool { store.focused == key && store.session?.status != .completed }

    var body: some View {
        Group {
            if isFocused {
                SetEditor(store: store, exercise: exercise, set: set, key: key)
                    .transition(.opacity.combined(with: .scale(scale: 0.98, anchor: .top)))
            } else {
                compact
                    .transition(.opacity)
            }
        }
        .animation(Theme.spring, value: isFocused)
    }

    private var compact: some View {
        Button {
            withAnimation(Theme.spring) { store.focused = key }
        } label: {
            HStack(spacing: 14) {
                SetBadge(index: set.index, logged: set.log != nil)
                if let log = set.log {
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(setText(weight: log.weight, reps: log.reps, bodyweight: exercise.loadType == .bodyweight))
                                .font(.number(.body))
                            if let rir = log.rir {
                                Text("@ \(rir) RIR")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if differsFromTarget(log) {
                            Text("Target \(targetText)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text(targetText)
                        .font(.number(.body, weight: .regular))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if set.log != nil, store.session?.status != .completed {
                    Image(systemName: "pencil")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 48)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let log = set.log {
                Button("Delete set", systemImage: "trash", role: .destructive) {
                    Task { await store.delete(log, key: key) }
                }
            }
        }
        .accessibilityLabel(accessibilityText)
        .accessibilityHint(set.log == nil ? "Opens the set editor" : "Edit this set")
    }

    private var targetText: String {
        let rir = "@ \(set.targetRir)"
        if exercise.loadType == .bodyweight || set.targetWeight == nil {
            return "\(set.targetReps) reps \(rir)"
        }
        return "\(Fmt.load(set.targetWeight, unit: store.loadUnit)) × \(set.targetReps) \(rir)"
    }

    private func differsFromTarget(_ log: SetLog) -> Bool {
        if log.reps != set.targetReps { return true }
        if let w = log.weight, let t = set.targetWeight, abs(w - t) > 0.01 { return true }
        return false
    }

    private var accessibilityText: String {
        if let log = set.log {
            let load = log.weight.map { "\(Fmt.load($0, unit: store.loadUnit)), " } ?? ""
            return "Set \(set.index + 1), done: \(load)\(log.reps) reps\(log.rir.map { ", \($0) in reserve" } ?? "")"
        }
        return "Set \(set.index + 1), target \(targetText)"
    }
}

private struct SetBadge: View {
    var index: Int
    var logged: Bool

    var body: some View {
        ZStack {
            if logged {
                Circle().fill(Color.green)
                Image(systemName: "checkmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .transition(.scale.combined(with: .opacity))
            } else {
                Circle().strokeBorder(Color.secondary.opacity(0.5), lineWidth: 1.5)
                Text("\(index + 1)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 28, height: 28)
        .animation(Theme.spring, value: logged)
    }
}

// MARK: - Set editor

/// The expanded set: weight and reps steppers prefilled with the target, RIR chips, one-tap log.
private struct SetEditor: View {
    var store: WorkoutStore
    var exercise: SessionExercise
    var set: SessionSet
    var key: WorkoutStore.SetKey

    @State private var editingWeight = false
    @State private var editingReps = false
    @State private var typed = ""

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var draft: WorkoutStore.SetDraft { store.draft(for: key) }
    private var isBodyweight: Bool { exercise.loadType == .bodyweight }
    private var isLogging: Bool { store.loggingKey == key }

    /// Weight and reps side by side, stacked at accessibility text sizes.
    private var stepperLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))
    }

    var body: some View {
        let options = exercise.loadOptions
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("Set \(set.index + 1)")
                    .font(.headline)
                Spacer()
                Text("Target \(targetText)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            stepperLayout {
                if isBodyweight && draft.weight == nil {
                    Button {
                        store.updateDraft(key) { $0.weight = store.loadUnit == .lb ? 5 : 2.5 }
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: "plus")
                                .font(.headline)
                            Text("Add load")
                                .font(.caption2.weight(.medium))
                                .textCase(.uppercase)
                        }
                        .foregroundStyle(.tint)
                        .frame(width: 96)
                        .frame(minHeight: Theme.bigTap + 8)
                        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add load to this bodyweight set")
                } else {
                    BigStepper(
                        value: Fmt.loadValue(draft.weight ?? 0),
                        unit: weightUnitLabel,
                        accessibilityName: isBodyweight ? "Added load" : "Weight",
                        canDecrement: isBodyweight || (draft.weight ?? 0) > (options.first ?? 0) + 0.001,
                        canIncrement: options.isEmpty || (draft.weight ?? 0) < (options.last ?? .infinity) - 0.001,
                        onDecrement: { step(up: false) },
                        onIncrement: { step(up: true) },
                        onTapValue: {
                            typed = Fmt.loadValue(draft.weight ?? 0)
                            editingWeight = true
                        }
                    )
                }
                BigStepper(
                    value: "\(draft.reps)",
                    unit: "reps",
                    accessibilityName: "Reps",
                    canDecrement: draft.reps > 0,
                    canIncrement: draft.reps < 100,
                    onDecrement: { store.updateDraft(key) { $0.reps = max(0, $0.reps - 1) } },
                    onIncrement: { store.updateDraft(key) { $0.reps = min(100, $0.reps + 1) } },
                    onTapValue: {
                        typed = "\(draft.reps)"
                        editingReps = true
                    }
                )
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Reps in reserve")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                ChoiceChips(
                    options: (0 ... 4).map { (value: $0, label: $0 == 4 ? "4+" : "\($0)") },
                    selection: Binding(
                        get: { draft.rir },
                        set: { value in store.updateDraft(key) { $0.rir = value } }
                    ),
                    height: 44
                )
                .accessibilityLabel("Reps in reserve")
            }

            HStack(spacing: 10) {
                if let log = set.log {
                    Button(role: .destructive) {
                        Task { await store.delete(log, key: key) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.headline)
                            .frame(width: 32, height: 40)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.large)
                    .accessibilityLabel("Delete set")
                }
                Button {
                    Task { await store.log(key) }
                } label: {
                    Group {
                        if isLogging {
                            ProgressView().tint(.white)
                        } else {
                            Label(set.log == nil ? "Log set" : "Update set", systemImage: "checkmark")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(isLogging || (!isBodyweight && draft.weight == nil))
                .sensoryFeedback(.impact(weight: .light), trigger: draft.weight)
            }
        }
        .padding(12)
        .background(Color.accentColor.opacity(0.08), in: .rect(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.accentColor.opacity(0.35), lineWidth: 1)
        }
        .alert("Weight (\(weightUnitLabel))", isPresented: $editingWeight) {
            TextField("Weight", text: $typed)
                .keyboardType(.decimalPad)
            Button("Set") {
                if let value = Double(typed.replacingOccurrences(of: ",", with: ".")), value >= 0 {
                    store.updateDraft(key) { $0.weight = value }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Reps", isPresented: $editingReps) {
            TextField("Reps", text: $typed)
                .keyboardType(.numberPad)
            Button("Set") {
                if let value = Int(typed), (0 ... 100).contains(value) {
                    store.updateDraft(key) { $0.reps = value }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var weightUnitLabel: String {
        switch exercise.loadType {
        case .dumbbell: "\(store.loadUnit.symbol) each"
        case .bodyweight: "\(store.loadUnit.symbol) added"
        default: store.loadUnit.symbol
        }
    }

    private var targetText: String {
        let rir = "@ \(set.targetRir)"
        if isBodyweight || set.targetWeight == nil { return "\(set.targetReps) reps \(rir)" }
        return "\(Fmt.loadValue(set.targetWeight)) × \(set.targetReps) \(rir)"
    }

    private func step(up: Bool) {
        store.updateDraft(key) { draft in
            draft.weight = store.steppedLoad(from: draft.weight, up: up, for: exercise)
        }
    }
}

/// "50 × 10", "BW + 25 × 8" or "12 reps".
func setText(weight: Double?, reps: Int, bodyweight: Bool) -> String {
    guard let weight else { return "\(reps) reps" }
    return bodyweight ? "BW + \(Fmt.loadValue(weight)) × \(reps)" : "\(Fmt.loadValue(weight)) × \(reps)"
}
