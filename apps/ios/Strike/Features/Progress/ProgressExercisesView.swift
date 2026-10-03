import SwiftUI

/// The current block's exercises first, then every exercise with logged sets by muscle, searchable.
struct ProgressExercisesView: View {
    @Environment(ProgressStore.self) private var progress
    @State private var query = ""

    private struct BlockExercise: Identifiable {
        var id: String
        var name: String
        var muscle: Muscle
        var days: [String]
    }

    /// Unique exercises across the block's days, in plan order, with the days that use them.
    private var blockExercises: [BlockExercise] {
        guard let meso = progress.meso else { return [] }
        var order: [String] = []
        var byId: [String: BlockExercise] = [:]
        for day in meso.days {
            for exercise in day.exercises {
                if byId[exercise.exerciseId] == nil {
                    order.append(exercise.exerciseId)
                    byId[exercise.exerciseId] = BlockExercise(id: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle, days: [])
                }
                if byId[exercise.exerciseId]?.days.contains(day.label) == false {
                    byId[exercise.exerciseId]?.days.append(day.label)
                }
            }
        }
        return order.compactMap { byId[$0] }
    }

    private var searchResults: [ExerciseInfo] {
        let all = progress.exercises ?? []
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return all }
        return all.filter {
            $0.name.localizedCaseInsensitiveContains(q)
                || $0.primary.displayName.localizedCaseInsensitiveContains(q)
                || $0.loadType.displayName.localizedCaseInsensitiveContains(q)
        }
    }

    var body: some View {
        List {
            if query.isEmpty {
                let block = blockExercises
                if !block.isEmpty {
                    Section("This block") {
                        ForEach(block) { exercise in
                            link(id: exercise.id, name: exercise.name, detail: "\(exercise.muscle.displayName) · \(exercise.days.joined(separator: ", "))")
                        }
                    }
                }
                if let all = progress.exercises {
                    ForEach(Muscle.allCases) { muscle in
                        let items = all.filter { $0.primary == muscle }
                        if !items.isEmpty {
                            Section(muscle.displayName) {
                                ForEach(items) { exercise in
                                    link(id: exercise.id, name: exercise.name, detail: exercise.loadType.displayName)
                                }
                            }
                        }
                    }
                }
            } else {
                Section {
                    ForEach(searchResults) { exercise in
                        link(id: exercise.id, name: exercise.name, detail: "\(exercise.primary.displayName) · \(exercise.loadType.displayName)")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if !query.isEmpty, searchResults.isEmpty {
                ContentUnavailableView.search(text: query)
            } else if progress.exercises == nil, blockExercises.isEmpty {
                ProgressView()
            }
        }
        .searchable(text: $query, prompt: "Search exercises")
        .navigationTitle("Exercises")
        .task {
            if progress.exercises == nil { await progress.loadExercises() }
        }
        .refreshable {
            async let exercises: Void = progress.loadExercises()
            async let meso: Void = progress.loadMeso()
            _ = await (exercises, meso)
        }
    }

    private func link(id: String, name: String, detail: String) -> some View {
        NavigationLink {
            ExerciseHistoryView(exerciseId: id, name: name)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
        }
    }
}
