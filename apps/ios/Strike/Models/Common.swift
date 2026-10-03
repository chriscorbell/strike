// Swift mirrors of packages/core/src/schemas.ts. Keep names and shapes in step with the TypeScript
// types; docs/api.md describes the wire conventions.
import Foundation

/// `"YYYY-MM-DD"`, a local calendar day in the profile's time zone.
typealias LocalDate = String
/// `"HH:MM"`, 24-hour local time.
typealias TimeOfDay = String
/// ISO-8601 UTC timestamp.
typealias Timestamp = String
/// 0 = Sunday … 6 = Saturday.
typealias Weekday = Int

enum Muscle: String, Codable, CaseIterable, Identifiable, Sendable {
    case chest
    case back
    case traps
    case frontDelts = "front_delts"
    case sideDelts = "side_delts"
    case rearDelts = "rear_delts"
    case biceps
    case triceps
    case forearms
    case quads
    case hamstrings
    case glutes
    case calves
    case abs

    var id: String { rawValue }
}

enum Location: String, Codable, CaseIterable, Identifiable, Sendable {
    case home
    case gym

    var id: String { rawValue }
}

enum EquipmentItem: String, Codable, CaseIterable, Identifiable, Sendable {
    case benchFlat = "bench_flat"
    case benchAdjustable = "bench_adjustable"
    case pullupBar = "pullup_bar"
    case dipStation = "dip_station"
    case cable
    case latPulldown = "lat_pulldown"
    case seatedRow = "seated_row"
    case legPress = "leg_press"
    case legExtension = "leg_extension"
    case legCurl = "leg_curl"
    case smithMachine = "smith_machine"
    case barbell
    case chestPressMachine = "chest_press_machine"
    case shoulderPressMachine = "shoulder_press_machine"
    case pecDeck = "pec_deck"

    var id: String { rawValue }
}

/// Weights are per dumbbell, in the profile's load unit. Tagged on `kind`.
enum DumbbellSet: Codable, Hashable, Sendable {
    case none
    case adjustable(min: Double, max: Double, step: Double)
    case fixed(weights: [Double])

    private enum CodingKeys: String, CodingKey { case kind, min, max, step, weights }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "none":
            self = .none
        case "adjustable":
            self = .adjustable(
                min: try c.decode(Double.self, forKey: .min),
                max: try c.decode(Double.self, forKey: .max),
                step: try c.decode(Double.self, forKey: .step)
            )
        case "fixed":
            self = .fixed(weights: try c.decode([Double].self, forKey: .weights))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "Unknown dumbbell kind \(other)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .none:
            try c.encode("none", forKey: .kind)
        case let .adjustable(min, max, step):
            try c.encode("adjustable", forKey: .kind)
            try c.encode(min, forKey: .min)
            try c.encode(max, forKey: .max)
            try c.encode(step, forKey: .step)
        case let .fixed(weights):
            try c.encode("fixed", forKey: .kind)
            try c.encode(weights, forKey: .weights)
        }
    }
}

struct LocationEquipment: Codable, Hashable, Sendable {
    var available: Bool
    var dumbbells: DumbbellSet
    var items: [EquipmentItem]
    /// Smallest jump on cable stacks and selectorized machines, in the load unit.
    var machineStep: Double
    var notes: String
}

enum Units: String, Codable, CaseIterable, Identifiable, Sendable {
    case imperial
    case metric

    var id: String { rawValue }
}

enum LoadUnit: String, Codable, Sendable {
    case lb
    case kg
}

enum DayType: String, Codable, CaseIterable, Identifiable, Sendable {
    case training
    case rest

    var id: String { rawValue }
}

struct Macros: Codable, Hashable, Sendable {
    var kcal: Double
    var proteinG: Double
    var carbsG: Double
    var fatG: Double

    static let zero = Macros(kcal: 0, proteinG: 0, carbsG: 0, fatG: 0)
}

struct NutritionTargets: Codable, Hashable, Sendable {
    struct Maintenance: Codable, Hashable, Sendable {
        var training: Double
        var rest: Double
    }

    var effectiveDate: LocalDate
    var training: Macros
    var rest: Macros
    var maintenanceKcal: Maintenance
    var reason: String
}

struct Measurements: Codable, Hashable, Sendable {
    var waistCm: Double?
    var neckCm: Double?
    var hipsCm: Double?
    var chestCm: Double?
    var armCm: Double?
    var thighCm: Double?
    var bodyFatPercent: Double?

    static let empty = Measurements()

    var isEmpty: Bool {
        [waistCm, neckCm, hipsCm, chestCm, armCm, thighCm, bodyFatPercent].allSatisfy { $0 == nil }
    }

    // Nullable on the wire: every key is sent, `null` when unknown.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(waistCm, forKey: .waistCm)
        try c.encode(neckCm, forKey: .neckCm)
        try c.encode(hipsCm, forKey: .hipsCm)
        try c.encode(chestCm, forKey: .chestCm)
        try c.encode(armCm, forKey: .armCm)
        try c.encode(thighCm, forKey: .thighCm)
        try c.encode(bodyFatPercent, forKey: .bodyFatPercent)
    }
}
