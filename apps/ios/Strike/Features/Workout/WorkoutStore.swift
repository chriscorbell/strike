import Foundation
import Observation
import SwiftUI

/// One lifting session: logging sets, rest timing, swaps, per-muscle feedback and finishing.
@MainActor
@Observable
final class WorkoutStore {
    struct SetKey: Hashable {
        var exerciseId: Int
        var index: Int
    }

    struct SetDraft: Equatable {
        var weight: Double?
        var reps: Int
        var rir: Int?
    }

    struct Rest: Equatable {
        var startedAt: Date
        var endsAt: Date
        var nextUp: String

        var duration: TimeInterval { endsAt.timeIntervalSince(startedAt) }
    }

    let sessionId: Int
    @ObservationIgnored private weak var app: AppModel?

    private(set) var session: Session?
    private(set) var loadError: String?
    private(set) var isWorking = false
    private(set) var loggingKey: SetKey?

    /// The set being edited; nil when everything is logged.
    var focused: SetKey?
    var drafts: [SetKey: SetDraft] = [:]
    /// Sets added on the phone beyond the plan, per session exercise, not yet logged.
    private(set) var addedSets: [Int: Int] = [:]

    private(set) var rest: Rest?
    /// Rest length overrides per exercise, in seconds.
    var restOverrides: [Int: TimeInterval] = [:]
    /// Bumps when a set is logged and when rest ends, for haptics.
    private(set) var loggedTick = 0
    private(set) var restEndedTick = 0

    /// Muscle whose post-exercise feedback is due.
    var feedbackMuscle: Muscle?
    private(set) var completion: CompleteSessionResponse?

    @ObservationIgnored private var restTask: Task<Void, Never>?

    init(sessionId: Int, app: AppModel) {
        self.sessionId = sessionId
        self.app = app
    }

    private var api: APIClient {
        get throws {
            guard let api = app?.api else { throw APIError.transport("Not connected to a server.") }
            return api
        }
    }

    var loadUnit: LoadUnit { session?.loadUnit ?? app?.loadUnit ?? .lb }
    var needsStart: Bool { session?.status == .planned }
    var isFinished: Bool { session?.status == .completed || session?.status == .skipped }

    // MARK: Loading

    func load() async {
        do {
            let session: Session = try await api.get("/api/sessions/\(sessionId)")
            adopt(session)
            loadError = nil
            if focused == nil, !isFinished { focusNext() }
        } catch {
            if session == nil { loadError = error.localizedDescription } else { app?.report(error) }
        }
    }

    private func adopt(_ new: Session) {
        // Local extra sets that the server now knows about are no longer "added".
        if let old = session {
            for exercise in new.exercises {
                guard let before = old.exercises.first(where: { $0.id == exercise.id }) else { continue }
                let grown = exercise.sets.count - before.sets.count
                if grown > 0, let added = addedSets[exercise.id] {
                    addedSets[exercise.id] = max(0, added - grown)
                }
            }
        }
        withAnimation(Theme.spring) { session = new }
    }

    // MARK: Starting

    func start(location: Location, soreness: [Muscle: Int]) async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            var session: Session = try await api.post("/api/sessions/\(sessionId)/start", LocationRequest(location: location))
            for (muscle, value) in soreness.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
                let existing = session.feedback.first { $0.muscle == muscle }
                let body = MuscleFeedback(
                    muscle: muscle,
                    soreness: value,
                    pump: existing?.pump,
                    workload: existing?.workload,
                    jointPain: existing?.jointPain ?? false
                )
                session = try await api.put("/api/sessions/\(sessionId)/feedback", body)
            }
            adopt(session)
            drafts = [:]
            focusNext()
            app?.today.markWorkoutChanged()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    func changeLocation(_ location: Location) async {
        guard location != session?.location else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            let session: Session = try await api.post("/api/sessions/\(sessionId)/location", LocationRequest(location: location))
            adopt(session)
            drafts = [:]
            focusNext()
        } catch {
            app?.report(error)
        }
    }

    // MARK: Sets

    /// The session's sets plus any added on the phone and not logged yet. The server creates an
    /// added set when it's first logged (`SessionSet.extra`).
    func rows(for exercise: SessionExercise) -> [SessionSet] {
        let count = addedSets[exercise.id] ?? 0
        guard count > 0 else { return exercise.sets }
        let last = exercise.sets.last
        let weight: Double? = last?.log?.weight ?? last?.targetWeight
        let reps: Int = last?.targetReps ?? exercise.repMin
        let rir: Int = last?.targetRir ?? session?.targetRir ?? 2
        var rows = exercise.sets
        for offset in 0 ..< count {
            let index = exercise.sets.count + offset
            rows.append(SessionSet(index: index, targetWeight: weight, targetReps: reps, targetRir: rir, log: nil, extra: true))
        }
        return rows
    }

    /// Swapping is refused once an exercise has logged sets.
    func canSwap(_ exercise: SessionExercise) -> Bool {
        session?.status != .completed && !exercise.sets.contains { $0.log != nil }
    }

    /// "Week 2 of 5" or "Deload".
    var weekLabel: String {
        guard let session else { return "" }
        if session.isDeload || session.week >= session.hardWeeks { return "Deload" }
        return "Week \(session.week + 1) of \(session.hardWeeks)"
    }

    func addSet(to exercise: SessionExercise) {
        withAnimation(Theme.spring) {
            addedSets[exercise.id, default: 0] += 1
            focused = SetKey(exerciseId: exercise.id, index: rows(for: exercise).count - 1)
        }
    }

    func removeAddedSet(from exercise: SessionExercise) {
        guard let count = addedSets[exercise.id], count > 0 else { return }
        withAnimation(Theme.spring) {
            addedSets[exercise.id] = count - 1
            if let focused, focused.exerciseId == exercise.id, focused.index >= rows(for: exercise).count {
                focusNext()
            }
        }
    }

    /// The editor values for a set: its log, else its targets, carrying forward a weight change made
    /// on an earlier set of the same exercise.
    func draft(for key: SetKey) -> SetDraft {
        if let draft = drafts[key] { return draft }
        guard let exercise = exercise(key.exerciseId) else { return SetDraft(weight: nil, reps: 0, rir: nil) }
        let rows = rows(for: exercise)
        guard rows.indices.contains(key.index) else { return SetDraft(weight: nil, reps: 0, rir: nil) }
        let set = rows[key.index]
        if let log = set.log {
            return SetDraft(weight: log.weight, reps: log.reps, rir: log.rir)
        }
        var weight = set.targetWeight
        if let previous = rows[..<key.index].last(where: { $0.log != nil }), let logged = previous.log?.weight {
            let changed = previous.targetWeight.map { abs(logged - $0) > 0.01 } ?? true
            if changed { weight = logged }
        }
        return SetDraft(weight: weight, reps: set.targetReps, rir: set.targetRir)
    }

    func updateDraft(_ key: SetKey, _ change: (inout SetDraft) -> Void) {
        var draft = draft(for: key)
        change(&draft)
        drafts[key] = draft
    }

    /// The next load up or down. Loaded work moves through the exercise's `loadOptions`, snapping onto
    /// the list when the current value is between options; bodyweight added load moves in small plates
    /// and drops back to nil (no added load) at zero.
    func steppedLoad(from current: Double?, up: Bool, for exercise: SessionExercise) -> Double? {
        let value = current ?? 0
        let options = exercise.loadOptions
        guard !options.isEmpty else {
            let next = value + (up ? 1 : -1) * (loadUnit == .lb ? 5 : 2.5)
            return next > 0 ? next : nil
        }
        if up {
            return options.first { $0 > value + 0.001 } ?? current
        }
        return options.last { $0 < value - 0.001 } ?? current
    }

    func log(_ key: SetKey) async {
        guard let exercise = exercise(key.exerciseId) else { return }
        let draft = draft(for: key)
        let wasLogged = rows(for: exercise)[safe: key.index]?.log != nil
        loggingKey = key
        defer { loggingKey = nil }
        do {
            let request = LogSetRequest(
                sessionExerciseId: exercise.id,
                setIndex: key.index,
                weight: draft.weight,
                reps: draft.reps,
                rir: draft.rir
            )
            let updated: Session = try await api.post("/api/sessions/\(sessionId)/sets", request)
            adopt(updated)
            drafts[key] = nil
            loggedTick += 1
            withAnimation(Theme.spring) { focusNext(after: key) }
            if !wasLogged {
                if focused != nil { startRest(after: exercise) } else { skipRest() }
                checkMuscleDone(exercise.muscle)
            }
            if updated.status == .inProgress { app?.today.markWorkoutChanged() }
        } catch {
            app?.report(error)
        }
    }

    func delete(_ log: SetLog, key: SetKey) async {
        do {
            let updated: Session = try await api.delete("/api/sessions/\(sessionId)/sets/\(log.id)")
            adopt(updated)
            drafts[key] = nil
            withAnimation(Theme.spring) { focused = key }
        } catch {
            app?.report(error)
        }
    }

    /// Moves focus to the first unlogged set, preferring the rest of the current exercise.
    func focusNext(after key: SetKey? = nil) {
        guard let session else { focused = nil; return }
        let exercises = session.exercises.sorted { $0.order < $1.order }
        if let key, let exercise = exercise(key.exerciseId),
           let next = rows(for: exercise).first(where: { $0.log == nil && $0.index > key.index }) {
            focused = SetKey(exerciseId: exercise.id, index: next.index)
            return
        }
        for exercise in exercises {
            if let next = rows(for: exercise).first(where: { $0.log == nil }) {
                focused = SetKey(exerciseId: exercise.id, index: next.index)
                return
            }
        }
        focused = nil
    }

    var progress: (done: Int, total: Int) {
        guard let session else { return (0, 0) }
        let all = session.exercises.flatMap { rows(for: $0) }
        return (all.filter { $0.log != nil }.count, all.count)
    }

    func exercise(_ id: Int) -> SessionExercise? {
        session?.exercises.first { $0.id == id }
    }

    var orderedExercises: [SessionExercise] {
        (session?.exercises ?? []).sorted { $0.order < $1.order }
    }

    // MARK: Rest timer

    func restSeconds(for exercise: SessionExercise) -> TimeInterval {
        restOverrides[exercise.id] ?? TimeInterval(exercise.restSeconds)
    }

    private func startRest(after exercise: SessionExercise) {
        let seconds = restSeconds(for: exercise)
        let now = Date.now
        rest = Rest(startedAt: now, endsAt: now.addingTimeInterval(seconds), nextUp: nextUpDescription())
        scheduleRestEnd()
    }

    func adjustRest(by seconds: TimeInterval) {
        guard var rest else { return }
        rest.endsAt = max(Date.now.addingTimeInterval(5), rest.endsAt.addingTimeInterval(seconds))
        self.rest = rest
        // Remember the preference for this exercise.
        if let focused, let exercise = exercise(focused.exerciseId) {
            restOverrides[exercise.id] = max(30, restSeconds(for: exercise) + seconds)
        }
        scheduleRestEnd()
    }

    func skipRest() {
        restTask?.cancel()
        app?.notifications.cancelRestEnd()
        withAnimation(Theme.spring) { rest = nil }
    }

    private func scheduleRestEnd() {
        guard let rest else { return }
        restTask?.cancel()
        app?.notifications.scheduleRestEnd(at: rest.endsAt, nextUp: rest.nextUp)
        restTask = Task { [weak self] in
            let delay = rest.endsAt.timeIntervalSinceNow
            if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
            guard !Task.isCancelled, let self else { return }
            self.restEndedTick += 1
            withAnimation(Theme.spring) { self.rest = nil }
        }
    }

    private func nextUpDescription() -> String {
        guard let focused, let exercise = exercise(focused.exerciseId) else { return "Time for your next set." }
        let draft = draft(for: focused)
        let load = draft.weight == nil ? "\(draft.reps) reps" : "\(Fmt.load(draft.weight, unit: loadUnit)) × \(draft.reps)"
        return "\(exercise.name) · set \(focused.index + 1): \(load)"
    }

    // MARK: Form guide

    func exerciseDetail(_ exerciseId: String) async throws -> ExerciseDetail {
        try await api.get("/api/exercises/\(exerciseId)")
    }

    // MARK: Swap

    func alternatives(for exercise: SessionExercise) async throws -> [ExerciseInfo] {
        try await api.get("/api/sessions/\(sessionId)/exercises/\(exercise.id)/alternatives")
    }

    func swap(_ exercise: SessionExercise, to replacement: ExerciseInfo, permanent: Bool) async -> Bool {
        do {
            let updated: Session = try await api.post(
                "/api/sessions/\(sessionId)/exercises/\(exercise.id)/swap",
                SwapRequest(exerciseId: replacement.id, permanent: permanent)
            )
            adopt(updated)
            drafts = drafts.filter { $0.key.exerciseId != exercise.id }
            focusNext()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    // MARK: Feedback

    func feedback(for muscle: Muscle) -> MuscleFeedback? {
        session?.feedback.first { $0.muscle == muscle }
    }

    private func checkMuscleDone(_ muscle: Muscle) {
        guard let session else { return }
        let exercises = session.exercises.filter { $0.muscle == muscle }
        let allDone = exercises.allSatisfy { exercise in rows(for: exercise).allSatisfy { $0.log != nil } }
        let existing = feedback(for: muscle)
        guard allDone, existing?.pump == nil, existing?.workload == nil else { return }
        // Let the logged-set animation finish before the sheet comes up.
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(700))
            self?.feedbackMuscle = muscle
        }
    }

    func submitFeedback(muscle: Muscle, pump: Int?, workload: Int?, jointPain: Bool) async {
        let existing = feedback(for: muscle)
        let body = MuscleFeedback(muscle: muscle, soreness: existing?.soreness, pump: pump, workload: workload, jointPain: jointPain)
        do {
            let updated: Session = try await api.put("/api/sessions/\(sessionId)/feedback", body)
            adopt(updated)
        } catch {
            app?.report(error)
        }
    }

    // MARK: Finish

    func complete() async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            let response: CompleteSessionResponse = try await api.post("/api/sessions/\(sessionId)/complete")
            skipRest()
            adopt(response.session)
            withAnimation(Theme.spring) { completion = response }
            await saveToHealth(response.session)
            app?.today.markWorkoutChanged()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    func skip() async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            let updated: Session = try await api.post("/api/sessions/\(sessionId)/skip")
            adopt(updated)
            skipRest()
            app?.today.markWorkoutChanged()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    private func saveToHealth(_ session: Session) async {
        guard let app, app.healthSyncEnabled, app.healthKit.isAvailable,
              let start = Dates.timestamp(session.startedAt) else { return }
        let end = Dates.timestamp(session.completedAt) ?? .now
        try? await app.healthKit.saveWorkout(start: start, end: end)
    }

    var startedAt: Date? { Dates.timestamp(session?.startedAt) }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
