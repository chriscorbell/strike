import SwiftUI

/// Alternatives for an exercise at the session's location, optionally for the rest of the block.
struct SwapExerciseSheet: View {
    var store: WorkoutStore
    var exercise: SessionExercise

    @Environment(\.dismiss) private var dismiss
    @State private var alternatives: [ExerciseInfo]?
    @State private var error: String?
    @State private var permanent = false
    @State private var swapping: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Toggle("Use for the rest of the block", isOn: $permanent)
                        .tint(.accentColor)
                } footer: {
                    Text(permanent ? "Future weeks use the new exercise too." : "Only today's session changes.")
                }

                if let alternatives {
                    if alternatives.isEmpty {
                        ContentUnavailableView("No alternatives here", systemImage: "dumbbell", description: Text("Nothing else at this location trains \(exercise.muscle.displayName.lowercased())."))
                    } else {
                        Section("Trains \(exercise.muscle.displayName.lowercased())") {
                            ForEach(alternatives) { option in
                                Button {
                                    Task { await swap(to: option) }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(option.name)
                                                .font(.body.weight(.medium))
                                                .foregroundStyle(Color.primary)
                                            Text("\(option.loadType.displayName) · \(option.repMin)–\(option.repMax) reps")
                                                .font(.footnote)
                                                .foregroundStyle(Color.secondary)
                                        }
                                        Spacer()
                                        if swapping == option.id {
                                            ProgressView()
                                        }
                                    }
                                    .frame(minHeight: 44)
                                    .contentShape(.rect)
                                }
                                .disabled(swapping != nil)
                            }
                        }
                    }
                } else if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                        Button("Try again") { Task { await load() } }
                    }
                } else {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Swap \(exercise.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
            }
            .task { await load() }
        }
        .presentationDetents([.medium, .large])
    }

    private func load() async {
        error = nil
        do {
            alternatives = try await store.alternatives(for: exercise)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func swap(to option: ExerciseInfo) async {
        swapping = option.id
        let ok = await store.swap(exercise, to: option, permanent: permanent)
        swapping = nil
        if ok { dismiss() }
    }
}
