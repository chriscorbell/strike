import Foundation

enum LoadType: String, Codable, Sendable {
    case dumbbell
    case barbell
    case smith
    case cable
    case machine
    case plateMachine = "plate_machine"
    case bodyweight
}

struct SetLog: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    /// Load in the session's unit; for bodyweight work, added load or nil.
    var weight: Double?
    var reps: Int
    var rir: Int?
    var loggedAt: Timestamp
}

struct SessionSet: Codable, Hashable, Sendable {
    var index: Int
    /// Per dumbbell for dumbbell work; total load otherwise; nil for bodyweight.
    var targetWeight: Double?
    var targetReps: Int
    var targetRir: Int
    var log: SetLog?
    /// Beyond the planned sets: added during the session. Deleting its log removes the set.
    var extra: Bool
}

struct LastTimeSet: Codable, Hashable, Sendable {
    var weight: Double?
    var reps: Double
    var rir: Double?
}

struct SessionExercise: Codable, Hashable, Identifiable, Sendable {
    struct LastTime: Codable, Hashable, Sendable {
        var date: LocalDate
        var sets: [LastTimeSet]
    }

    var id: Int
    var exerciseId: String
    var name: String
    var muscle: Muscle
    var loadType: LoadType
    var order: Int
    var repMin: Int
    var repMax: Int
    var sets: [SessionSet]
    var cues: String
    var notes: String
    /// Plain-language reason for today's prescription, e.g. "Up 5 lb: you beat last week's target".
    var prescriptionNote: String
    /// The heaviest available weight is still light for the rep range.
    var maxedOut: Bool
    /// Every load available for this exercise at the session's location, ascending, in the session's
    /// load unit. Empty for bodyweight work.
    var loadOptions: [Double]
    /// Suggested rest between sets: longer for compound lifts.
    var restSeconds: Int
    var lastTime: LastTime?
    var substitutedFrom: String?
}

/// Pump 0…2 low/moderate/amazing. Workload 0…3 easy/just right/hard/too much.
/// Soreness 0…3 never sore/healed a while ago/healed just in time/still sore.
struct MuscleFeedback: Codable, Hashable, Sendable {
    var muscle: Muscle
    var soreness: Int?
    var pump: Int?
    var workload: Int?
    var jointPain: Bool

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(muscle, forKey: .muscle)
        try c.encode(soreness, forKey: .soreness)
        try c.encode(pump, forKey: .pump)
        try c.encode(workload, forKey: .workload)
        try c.encode(jointPain, forKey: .jointPain)
    }
}

enum SessionStatus: String, Codable, Sendable {
    case planned
    case inProgress = "in_progress"
    case completed
    case skipped
}

struct Session: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var mesoId: Int
    /// 0-based: week 0 is the first week of the block.
    var week: Int
    var dayIndex: Int
    /// Hard weeks in the block; `week == hardWeeks` is the deload.
    var hardWeeks: Int
    var label: String
    var location: Location
    var status: SessionStatus
    var date: LocalDate?
    var startedAt: Timestamp?
    var completedAt: Timestamp?
    var targetRir: Int
    var isDeload: Bool
    var exercises: [SessionExercise]
    var feedback: [MuscleFeedback]
    var loadUnit: LoadUnit
}

struct LogSetRequest: Encodable, Sendable {
    var sessionExerciseId: Int
    var setIndex: Int
    var weight: Double?
    var reps: Int
    var rir: Int?

    private enum CodingKeys: String, CodingKey { case sessionExerciseId, setIndex, weight, reps, rir }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(sessionExerciseId, forKey: .sessionExerciseId)
        try c.encode(setIndex, forKey: .setIndex)
        try c.encode(weight, forKey: .weight)
        try c.encode(reps, forKey: .reps)
        try c.encode(rir, forKey: .rir)
    }
}

struct MesoExercisePlan: Codable, Hashable, Sendable {
    var exerciseId: String
    var sets: Int
    var repMin: Int
    var repMax: Int
    /// First-session weight in the load unit, per dumbbell for dumbbell work. Nil for bodyweight.
    var startWeight: Double?
    var notes: String
}

struct MesoDayPlan: Codable, Hashable, Sendable {
    var label: String
    var location: Location
    var focus: String
    var exercises: [MesoExercisePlan]
}

struct MesoPlan: Codable, Hashable, Sendable {
    var name: String
    var split: String
    /// Hard weeks before the deload week.
    var weeks: Int
    var rationale: String
    var days: [MesoDayPlan]
}

struct SessionSummary: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var mesoId: Int
    var week: Int
    var dayIndex: Int
    var label: String
    var location: Location
    var status: SessionStatus
    var isDeload: Bool
    var date: LocalDate?
    var completedAt: Timestamp?
    var setCount: Int
    /// Sum of weight × reps for loaded sets, in the load unit.
    var volume: Double
}

struct CompleteSessionResponse: Codable, Sendable {
    struct PR: Codable, Hashable, Sendable {
        var exerciseId: String
        var name: String
        var e1rm: Double
        var previous: Double?
    }

    struct Summary: Codable, Hashable, Sendable {
        var setCount: Int
        var volume: Double
        var prs: [PR]
        var durationMinutes: Double?
    }

    var session: Session
    var summary: Summary
}

enum MesoStatus: String, Codable, Sendable {
    case active
    case completed
}

struct MesoOverview: Codable, Hashable, Identifiable, Sendable {
    struct DayExercise: Codable, Hashable, Sendable {
        var exerciseId: String
        var name: String
        var muscle: Muscle
        var sets: Int
        var repMin: Int
        var repMax: Int
    }

    struct Day: Codable, Hashable, Sendable {
        var label: String
        var location: Location
        var focus: String
        var exercises: [DayExercise]
    }

    struct Cell: Codable, Hashable, Sendable {
        var sessionId: Int
        var status: SessionStatus
        var date: LocalDate?
    }

    var id: Int
    var name: String
    var split: String
    var rationale: String
    var source: PlanSource
    var startDate: LocalDate
    var hardWeeks: Int
    var status: MesoStatus
    var days: [Day]
    /// weeks (hard weeks + deload) × days, the session in each cell when it exists.
    var grid: [[Cell?]]
}

struct ExerciseInfo: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var name: String
    var primary: Muscle
    var secondary: [Muscle]
    var loadType: LoadType
    var repMin: Int
    var repMax: Int
    var cues: String
    var availableAt: [Location]
}

/// One exercise with its form guide and technique video.
struct ExerciseDetail: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var name: String
    var primary: Muscle
    var secondary: [Muscle]
    var loadType: LoadType
    var repMin: Int
    var repMax: Int
    var cues: String
    var availableAt: [Location]
    var guide: ExerciseGuide
}

struct ExerciseGuide: Codable, Hashable, Sendable {
    /// Getting into position: equipment, grip, stance, brace.
    var setup: [String]
    /// One rep, start to finish.
    var steps: [String]
    /// The usual errors, each phrased as the fix.
    var mistakes: [String]
    var video: ExerciseVideo
}

struct ExerciseVideo: Codable, Hashable, Sendable {
    var youtubeId: String
    var title: String
    var channel: String
    /// Length of the whole video.
    var seconds: Int
    /// Where this exercise's technique starts.
    var start: Int
}

struct ExerciseHistoryResponse: Codable, Sendable {
    struct Point: Codable, Hashable, Sendable {
        var date: LocalDate
        var sessionId: Int
        var bestWeight: Double?
        var bestReps: Double
        var e1rm: Double?
        var sets: [LastTimeSet]
    }

    var exercise: ExerciseInfo
    var points: [Point]
}
