import Foundation
import Observation
import SwiftUI

/// Body weight, measurements and training history for the Progress tab.
@MainActor
@Observable
final class ProgressStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    enum WeightRange: Int, CaseIterable, Identifiable, Sendable {
        case month = 30
        case quarter = 90
        case half = 180

        var id: Int { rawValue }
        var label: String { "\(rawValue)D" }
        var accessibilityName: String { "\(rawValue) days" }
    }

    var range: WeightRange = .quarter

    private(set) var weights: WeightsResponse?
    private(set) var weightsError: String?
    /// Every weigh-in on record, newest first.
    private(set) var weighIns: [WeightPoint]?
    private(set) var measurements: [MeasurementEntry]?
    private(set) var sessions: [SessionSummary]?
    private(set) var meso: MesoOverview?
    private(set) var exercises: [ExerciseInfo]?

    // MARK: Dashboard

    func load() async {
        guard app?.api != nil else { return }
        async let weights: Void = loadWeights()
        async let sessions: Void = loadSessions()
        async let measurements: Void = loadMeasurements()
        async let meso: Void = loadMeso()
        _ = await (weights, sessions, measurements, meso)
    }

    func loadWeights() async {
        do {
            let response: WeightsResponse = try await api.get("/api/weights", query: ["days": "\(range.rawValue)"])
            withAnimation(Theme.spring) { weights = response }
            weightsError = nil
        } catch is CancellationError {
        } catch {
            if weights == nil {
                weightsError = error.localizedDescription
            } else {
                app?.report(error)
            }
        }
    }

    func loadSessions() async {
        do {
            let response: [SessionSummary] = try await api.get("/api/sessions", query: ["limit": "30"])
            withAnimation(Theme.spring) { sessions = response }
        } catch {
            app?.report(error)
        }
    }

    func loadMeasurements() async {
        do {
            let response: [MeasurementEntry] = try await api.get("/api/measurements")
            withAnimation(Theme.spring) { measurements = response }
        } catch {
            app?.report(error)
        }
    }

    func loadMeso() async {
        do {
            let response: MesoOverview? = try await api.get("/api/meso")
            meso = response
        } catch {
            app?.report(error)
        }
    }

    func loadExercises() async {
        do {
            let response: [ExerciseInfo] = try await api.get("/api/exercises", query: ["logged": "1"])
            exercises = response
        } catch {
            app?.report(error)
        }
    }

    // MARK: Weigh-ins

    func loadWeighIns() async {
        do {
            // The server caps the window at ten years, which covers every weigh-in on record.
            let response: WeightsResponse = try await api.get("/api/weights", query: ["days": "3650"])
            withAnimation(Theme.spring) {
                weighIns = response.points.filter { $0.weightKg != nil }.reversed()
            }
        } catch {
            app?.report(error)
        }
    }

    /// Saves a manual weigh-in (replacing any entry for that day) and refreshes what depends on it.
    func saveWeight(date: LocalDate, kg: Double) async -> Bool {
        do {
            let _: WeightEntry = try await api.post("/api/weights", WeightEntry(date: date, weightKg: kg, source: .manual))
            await afterWeightChange(date: date)
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    func deleteWeight(date: LocalDate) async {
        let previous = weighIns
        withAnimation(Theme.spring) { weighIns?.removeAll { $0.date == date } }
        do {
            let _: OkResponse = try await api.delete("/api/weights/\(date)")
            await afterWeightChange(date: date)
        } catch {
            withAnimation(Theme.spring) { weighIns = previous }
            app?.report(error)
        }
    }

    private func afterWeightChange(date: LocalDate) async {
        async let list: Void = loadWeighIns()
        async let chart: Void = loadWeights()
        _ = await (list, chart)
        if date == app?.today.date {
            await app?.today.load()
        }
    }

    // MARK: Measurements

    /// Saves a set of measurements; returns the stored entry, with body fat filled in when the server estimated it.
    func saveMeasurement(_ request: MeasurementRequest) async -> MeasurementEntry? {
        do {
            let entry: MeasurementEntry = try await api.post("/api/measurements", request)
            await loadMeasurements()
            return entry
        } catch {
            app?.report(error)
            return nil
        }
    }

    func deleteMeasurement(_ entry: MeasurementEntry) async {
        let before = measurements
        measurements?.removeAll { $0.id == entry.id }
        do {
            let _: OkResponse = try await api.delete("/api/measurements/\(entry.id)")
        } catch {
            measurements = before
            app?.report(error)
        }
    }

    // MARK: Detail fetches

    func session(_ id: Int) async throws -> Session {
        try await api.get("/api/sessions/\(id)")
    }

    func exerciseHistory(_ id: String) async throws -> ExerciseHistoryResponse {
        try await api.get("/api/exercises/\(id)/history")
    }
}
