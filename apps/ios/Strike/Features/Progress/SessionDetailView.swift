import SwiftUI

/// Read-only view of one session (completed or skipped): when and where, each exercise's sets
/// against their targets, and the muscle feedback.
struct SessionDetailView: View {
    let sessionId: Int

    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress
    @State private var session: Session?
    @State private var loadError: String?

    var body: some View {
        Group {
            if let session {
                content(session)
            } else if let loadError {
                LoadErrorView(message: loadError) { await load() }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(session?.label ?? "Session")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        do {
            let response = try await progress.session(sessionId)
            withAnimation(Theme.spring) { session = response }
            loadError = nil
        } catch is CancellationError {
        } catch {
            if session == nil {
                loadError = error.localizedDescription
            } else {
                app.report(error)
            }
        }
    }

    // MARK: Content

    private func content(_ session: Session) -> some View {
        let logs = session.exercises.flatMap { $0.sets.compactMap(\.log) }
        let planned = session.exercises.reduce(0) { $0 + $1.sets.count }
        let volume = logs.reduce(0.0) { $0 + ($1.weight ?? 0) * Double($1.reps) }

        return List {
            Section {
                ValueRow(label: "Date", value: dateText(session))
                ValueRow(label: "Location", value: session.location.displayName)
                if let duration = duration(session) {
                    ValueRow(label: "Duration", value: duration)
                }
                ValueRow(label: "Sets", value: "\(logs.count) of \(planned)")
                if volume > 0 {
                    ValueRow(label: "Volume", value: "\(Fmt.integer(volume)) \(session.loadUnit.symbol)")
                }
            } header: {
                HStack(spacing: 6) {
                    Tag(text: "Week \(session.week + 1)")
                    if session.isDeload {
                        Tag(text: "Deload", tint: .accentColor)
                    }
                    if session.status == .skipped {
                        Tag(text: "Skipped", tint: Theme.warning)
                    } else if session.status == .inProgress {
                        Tag(text: "In progress", tint: .accentColor)
                    }
                }
                .textCase(nil)
                .padding(.bottom, 4)
            }

            ForEach(session.exercises.sorted { $0.order < $1.order }) { exercise in
                Section {
                    ForEach(exercise.sets, id: \.index) { set in
                        SessionDetailSetRow(set: set)
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(exercise.name)
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Text("\(exercise.muscle.displayName) · \(loadCaption(exercise, unit: session.loadUnit))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .textCase(nil)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isHeader)
                } footer: {
                    if let from = exercise.substitutedFrom, !from.isEmpty {
                        Text("Swapped in for \(from)")
                    }
                }
            }

            if !session.feedback.isEmpty {
                Section("Muscle feedback") {
                    ForEach(session.feedback, id: \.muscle) { feedback in
                        SessionDetailFeedbackRow(feedback: feedback)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    private func dateText(_ session: Session) -> String {
        if let date = session.date { return Dates.long(date) }
        if let done = Dates.timestamp(session.completedAt) { return Dates.long(Dates.localDate(from: done)) }
        return "—"
    }

    private func duration(_ session: Session) -> String? {
        guard let start = Dates.timestamp(session.startedAt), let end = Dates.timestamp(session.completedAt), end > start else { return nil }
        let minutes = end.timeIntervalSince(start) / 60
        return minutes < 1 ? "Under a minute" : Fmt.minutes(minutes)
    }

    private func loadCaption(_ exercise: SessionExercise, unit: LoadUnit) -> String {
        switch exercise.loadType {
        case .bodyweight: "Bodyweight"
        case .dumbbell: "\(unit.symbol) per hand"
        default: unit.symbol
        }
    }
}

/// "2   50 × 11 @3        Target 50 × 10 @3"
private struct SessionDetailSetRow: View {
    var set: SessionSet

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(set.index + 1)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(minWidth: 18, alignment: .leading)
            if let log = set.log {
                Text(ProgressFormat.set(weight: log.weight, reps: log.reps, rir: log.rir))
                    .font(.body.weight(.medium))
            } else {
                Text("Not logged")
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text("Target \(ProgressFormat.set(weight: set.targetWeight, reps: set.targetReps, rir: set.targetRir))")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .monospacedDigit()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Set \(set.index + 1)")
    }
}

private struct SessionDetailFeedbackRow: View {
    var feedback: MuscleFeedback

    private var details: String {
        var parts: [String] = []
        if let soreness = Self.label(FeedbackScale.soreness, feedback.soreness) { parts.append("Soreness: \(soreness)") }
        if let pump = Self.label(FeedbackScale.pump, feedback.pump) { parts.append("Pump: \(pump)") }
        if let workload = Self.label(FeedbackScale.workload, feedback.workload) { parts.append("Workload: \(workload)") }
        return parts.joined(separator: " · ")
    }

    private static func label(_ scale: [String], _ index: Int?) -> String? {
        guard let index, scale.indices.contains(index) else { return nil }
        return scale[index].lowercased()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(feedback.muscle.displayName)
                    .font(.body.weight(.medium))
                Spacer(minLength: 8)
                if feedback.jointPain {
                    Label("Joint pain", systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.warning)
                }
            }
            if !details.isEmpty {
                Text(details)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

/// Set text shared by the Progress screens.
enum ProgressFormat {
    /// "50 × 10 @2", "12 reps @1", or without RIR when unknown.
    static func set(weight: Double?, reps: Int, rir: Int?) -> String {
        let base = Fmt.set(weight: weight, reps: reps)
        guard let rir else { return base }
        return "\(base) @\(rir)"
    }
}
