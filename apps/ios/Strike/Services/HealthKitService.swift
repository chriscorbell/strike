import Foundation
import HealthKit

/// Apple Health: reads body mass for the weight trend and saves finished sessions as workouts.
@MainActor
final class HealthKitService {
    private let store = HKHealthStore()
    private let bodyMass = HKQuantityType(.bodyMass)

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    /// Asks for read access to body mass and write access to workouts. HealthKit never says whether
    /// read access was granted, so a denied read simply returns no samples.
    func requestAuthorization() async throws {
        guard isAvailable else { throw HealthKitError.unavailable }
        try await store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [bodyMass])
    }

    var canSaveWorkouts: Bool {
        isAvailable && store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
    }

    /// Reads the last 30 days of body mass and posts each day's earliest reading to the server.
    /// Returns how many the server imported.
    func syncBodyMass(api: APIClient, days: Int = 30) async throws -> Int {
        guard isAvailable else { return 0 }
        let start = Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .now
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: bodyMass, predicate: HKQuery.predicateForSamples(withStart: start, end: nil))],
            sortDescriptors: [SortDescriptor(\.startDate, order: .forward)]
        )
        let samples = try await descriptor.result(for: store)

        var firstByDay: [LocalDate: Double] = [:]
        for sample in samples {
            let day = Dates.localDate(from: sample.startDate)
            if firstByDay[day] == nil {
                firstByDay[day] = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            }
        }
        guard !firstByDay.isEmpty else { return 0 }

        let entries = firstByDay
            .sorted { $0.key < $1.key }
            .map { WeightBatchRequest.Entry(date: $0.key, weightKg: ($0.value * 100).rounded() / 100) }
        let response: WeightBatchResponse = try await api.post("/api/weights/batch", WeightBatchRequest(entries: entries))
        return response.imported
    }

    /// Saves a traditional strength training workout spanning the session.
    func saveWorkout(start: Date, end: Date) async throws {
        guard isAvailable else { throw HealthKitError.unavailable }
        guard end > start else { return }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        try await builder.beginCollection(at: start)
        try await builder.endCollection(at: end)
        _ = try await builder.finishWorkout()
    }
}

enum HealthKitError: LocalizedError {
    case unavailable

    var errorDescription: String? { "Apple Health isn't available on this device." }
}
