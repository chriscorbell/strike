import Foundation

struct HealthResponse: Codable, Sendable {
    struct Coach: Codable, Sendable {
        var configured: Bool
    }

    var ok: Bool
    var version: String
    var coach: Coach
}

struct StateResponse: Codable, Sendable {
    var onboarded: Bool
    var profile: Profile?
    var targets: NutritionTargets?
    /// Whether the coach (Claude) is configured on the server.
    var coachAvailable: Bool
    var today: LocalDate
}

struct OnboardingRequest: Encodable, Sendable {
    var profile: Profile
    var weightKg: Double
    var measurements: Measurements?

    private enum CodingKeys: String, CodingKey { case profile, weightKg, measurements }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(profile, forKey: .profile)
        try c.encode(weightKg, forKey: .weightKg)
        try c.encode(measurements, forKey: .measurements)
    }
}

struct TimelineMeal: Codable, Hashable, Sendable {
    var time: TimeOfDay
    var slotIndex: Int
    var label: String
    var role: MealRole
    var targets: Macros
    /// The planned dish first, then the other options for this meal.
    var options: [MealOption]
    /// The option the week's plan assigns to this meal; nil without a plan.
    var plannedOptionId: String?
    var log: MealLog?

    var plannedOption: MealOption? {
        plannedOptionId.flatMap { id in options.first { $0.id == id } }
    }
}

struct TimelineWorkout: Codable, Hashable, Sendable {
    var time: TimeOfDay
    var endTime: TimeOfDay
    var sessionId: Int
    var label: String
    var location: Location
    var status: SessionStatus
    var exerciseCount: Int
    var setCount: Int
}

/// Tagged on `kind`: `"meal"` or `"workout"`.
enum TimelineItem: Codable, Hashable, Sendable, Identifiable {
    case meal(TimelineMeal)
    case workout(TimelineWorkout)

    private enum CodingKeys: String, CodingKey { case kind }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "meal": self = .meal(try TimelineMeal(from: decoder))
        case "workout": self = .workout(try TimelineWorkout(from: decoder))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "Unknown timeline kind \(other)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .meal(meal):
            try c.encode("meal", forKey: .kind)
            try meal.encode(to: encoder)
        case let .workout(workout):
            try c.encode("workout", forKey: .kind)
            try workout.encode(to: encoder)
        }
    }

    var id: String {
        switch self {
        case let .meal(meal): "meal-\(meal.slotIndex)"
        case let .workout(workout): "workout-\(workout.sessionId)"
        }
    }

    var time: TimeOfDay {
        switch self {
        case let .meal(meal): meal.time
        case let .workout(workout): workout.time
        }
    }
}

struct TodayResponse: Codable, Sendable {
    struct Weight: Codable, Hashable, Sendable {
        var loggedKg: Double?
        var trendKg: Double?
    }

    struct Meso: Codable, Hashable, Sendable {
        var id: Int
        var name: String
        var week: Int
        var hardWeeks: Int
        var isDeload: Bool
        var targetRir: Int
    }

    struct NextSession: Codable, Hashable, Sendable {
        var id: Int
        var label: String
        var location: Location
        var week: Int
        var dayIndex: Int
    }

    var date: LocalDate
    var dayType: DayType
    /// Set when the workout time differs from the profile default for this date.
    var workoutTimeOverride: TimeOfDay?
    var weight: Weight
    var targets: Macros
    var consumed: Macros
    var timeline: [TimelineItem]
    /// Meals logged outside the plan's slots.
    var extraMeals: [MealLog]
    var meso: Meso?
    /// The next session not yet done, which may be today's.
    var nextSession: NextSession?
    var checkIn: CheckInStatus
    /// Coach jobs still queued or running.
    var pendingJobs: [Job]
    var menuReady: Bool
    /// Next plan week, from the evening before shopping day until it starts.
    var upcomingWeek: UpcomingWeek?

    var meals: [TimelineMeal] {
        timeline.compactMap { if case let .meal(meal) = $0 { meal } else { nil } }
    }

    var workout: TimelineWorkout? {
        timeline.lazy.compactMap { if case let .workout(workout) = $0 { workout } else { nil } }.first
    }
}

struct UpcomingWeek: Codable, Hashable, Sendable {
    var weekStart: LocalDate
    var shoppingDate: LocalDate
    var ready: Bool
    var menuId: Int?
    /// Items to buy, not counting pantry staples.
    var itemCount: Int
    var costUsd: Double
}

struct WeightPoint: Codable, Hashable, Sendable {
    var date: LocalDate
    var weightKg: Double?
    var trendKg: Double
}

struct WeightsResponse: Codable, Sendable {
    var points: [WeightPoint]
    var rateKgPerWeek: Double?
    var targetRateKgPerWeek: Double
    var latestTrendKg: Double?
}

enum WeightSource: String, Codable, Sendable {
    case manual
    case healthkit
}

struct WeightEntry: Codable, Hashable, Sendable {
    var date: LocalDate
    var weightKg: Double
    var source: WeightSource
}

struct WeightBatchRequest: Encodable, Sendable {
    struct Entry: Encodable, Sendable {
        var date: LocalDate
        var weightKg: Double
    }

    var entries: [Entry]
    var source: WeightSource = .healthkit
}

struct WeightBatchResponse: Decodable, Sendable {
    var imported: Int
}

struct MeasurementEntry: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var date: LocalDate
    var waistCm: Double?
    var neckCm: Double?
    var hipsCm: Double?
    var chestCm: Double?
    var armCm: Double?
    var thighCm: Double?
    var bodyFatPercent: Double?

    var measurements: Measurements {
        Measurements(waistCm: waistCm, neckCm: neckCm, hipsCm: hipsCm, chestCm: chestCm, armCm: armCm, thighCm: thighCm, bodyFatPercent: bodyFatPercent)
    }
}

/// `POST /api/measurements` body: `{ date, ...Measurements }`.
struct MeasurementRequest: Encodable, Sendable {
    var date: LocalDate
    var measurements: Measurements

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DateKey.self)
        try c.encode(date, forKey: .date)
        try measurements.encode(to: encoder)
    }

    private enum DateKey: String, CodingKey { case date }
}

struct OkResponse: Decodable, Sendable {
    var ok: Bool
}

/// `{ note?: string }` bodies for regenerate and check-in calls.
struct NoteRequest: Encodable, Sendable {
    var note: String?
}

struct WorkoutTimeRequest: Encodable, Sendable {
    var time: TimeOfDay?

    private enum CodingKeys: String, CodingKey { case time }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(time, forKey: .time)
    }
}

struct LocationRequest: Encodable, Sendable {
    var location: Location?
}

struct SwapRequest: Encodable, Sendable {
    var exerciseId: String
    var permanent: Bool
}

struct EstimateRequest: Encodable, Sendable {
    var description: String
}

struct MoreOptionsRequest: Encodable, Sendable {
    var date: LocalDate
    var slotIndex: Int
}

struct EmptyBody: Encodable, Sendable {}
