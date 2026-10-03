import SwiftUI

/// Before a planned session: where you're lifting, how sore each muscle is, and what's coming.
struct WorkoutStartView: View {
    var store: WorkoutStore
    var session: Session

    @State private var location: Location
    @State private var soreness: [Muscle: Int] = [:]

    init(store: WorkoutStore, session: Session) {
        self.store = store
        self.session = session
        _location = State(initialValue: session.location)
    }

    /// Muscles trained today, in exercise order.
    private var muscles: [Muscle] {
        var seen = Set<Muscle>()
        return store.orderedExercises.compactMap { seen.insert($0.muscle).inserted ? $0.muscle : nil }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                locationPicker
                sorenessCheck
                preview
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                Task { await store.start(location: location, soreness: soreness) }
            } label: {
                Group {
                    if store.isWorking {
                        ProgressView().tint(.white)
                    } else {
                        Label("Start workout", systemImage: "play.fill")
                    }
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(store.isWorking)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(session.label)
                .font(.largeTitle.weight(.bold))
            HStack(spacing: 8) {
                Tag(text: store.weekLabel, tint: .accentColor)
                Tag(text: "\(session.targetRir) RIR")
                Tag(text: "\(store.orderedExercises.count) exercises")
                Tag(text: "\(store.progress.total) sets")
            }
        }
    }

    private var locationPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Where are you lifting?")
                .font(.headline)
            HStack(spacing: 12) {
                ForEach(Location.allCases) { option in
                    let selected = option == location
                    Button {
                        withAnimation(Theme.snappy) { location = option }
                    } label: {
                        VStack(spacing: 8) {
                            Image(systemName: option.symbol)
                                .font(.title2)
                            Text(option.displayName)
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 84)
                        .foregroundStyle(selected ? Color.white : Color.primary)
                        .background(
                            selected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(Theme.cardBackground),
                            in: .rect(cornerRadius: Theme.smallRadius + 4, style: .continuous)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .sensoryFeedback(.selection, trigger: location)
            if location != session.location {
                Text("Exercises your \(location == .home ? "home setup" : "gym") can't support get swapped when you start.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .transition(.opacity)
            }
        }
    }

    private var sorenessCheck: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Soreness check")
                    .font(.headline)
                Text("Since you last trained each muscle. Optional.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ForEach(muscles) { muscle in
                VStack(alignment: .leading, spacing: 8) {
                    Text(muscle.displayName)
                        .font(.subheadline.weight(.semibold))
                    ChoiceChips(
                        options: [(0, "Never sore"), (1, "Healed early"), (2, "Just healed"), (3, "Still sore")],
                        selection: Binding(
                            get: { soreness[muscle] },
                            set: { soreness[muscle] = $0 }
                        ),
                        tint: .accentColor,
                        height: 48
                    )
                    .accessibilityLabel("\(muscle.displayName) soreness")
                }
            }
        }
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Today")
                .font(.headline)
                .padding(.bottom, 10)
            VStack(spacing: 0) {
                ForEach(Array(store.orderedExercises.enumerated()), id: \.element.id) { index, exercise in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exercise.name)
                                .font(.body.weight(.medium))
                            Text(exercise.muscle.displayName)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(previewTarget(exercise))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .padding(.vertical, 12)
                    if index < store.orderedExercises.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, Theme.padding)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }

    private func previewTarget(_ exercise: SessionExercise) -> String {
        let sets = exercise.sets.count
        guard let first = exercise.sets.first else { return "" }
        if exercise.loadType == .bodyweight {
            return "\(sets) × \(first.targetReps)"
        }
        return "\(sets) × \(first.targetReps) · \(Fmt.load(first.targetWeight, unit: store.loadUnit))"
    }
}
