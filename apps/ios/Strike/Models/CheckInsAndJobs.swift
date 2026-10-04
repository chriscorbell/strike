import Foundation

struct CheckIn: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var weekStart: LocalDate
    var createdAt: Timestamp
    var trendKg: Double?
    var rateKgPerWeek: Double?
    var targetRateKgPerWeek: Double
    var weighIns: Int
    var adjustmentKcal: Double
    var adjustmentReason: String
    var sessionsCompleted: Int
    var sessionsPlanned: Int
    var mealAdherence: Double?
    var coachNote: String?
    var userNote: String?
}

/// `GET /api/checkins/status`.
struct CheckInStatus: Codable, Hashable, Sendable {
    var due: Bool
    var latest: CheckIn?
}

enum JobKind: String, Codable, Sendable {
    case mesocycle
    case mealMenu = "meal_menu"
    case prepGuide = "prep_guide"
    case checkInNote = "check_in_note"
    case moreOptions = "more_options"
    case estimateMeal = "estimate_meal"
    /// A kind this build doesn't know yet; decoding never fails on new server jobs.
    case other

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = JobKind(rawValue: raw) ?? .other
    }
}

enum JobStatus: String, Codable, Sendable {
    case queued
    case running
    case succeeded
    case failed

    var isFinished: Bool { self == .succeeded || self == .failed }
}

struct Job: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var kind: JobKind
    var status: JobStatus
    var error: String?
    /// Arbitrary JSON whose shape depends on `kind`; decode it with `decodeResult(as:)`.
    var result: JSONValue?
    var createdAt: Timestamp
    var updatedAt: Timestamp

    /// `estimate_meal` → `MealEstimate`, `more_options` → `[MealOption]`.
    func decodeResult<T: Decodable>(as type: T.Type) throws -> T {
        guard let result else {
            throw DecodingError.valueNotFound(T.self, .init(codingPath: [], debugDescription: "Job \(id) has no result"))
        }
        let data = try JSONEncoder().encode(result)
        return try JSONDecoder().decode(T.self, from: data)
    }
}

/// Any JSON value, for payloads whose shape the contract leaves open.
enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let value = try? c.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? c.decode(Double.self) {
            self = .number(value)
        } else if let value = try? c.decode(String.self) {
            self = .string(value)
        } else if let value = try? c.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case let .bool(value): try c.encode(value)
        case let .number(value): try c.encode(value)
        case let .string(value): try c.encode(value)
        case let .array(value): try c.encode(value)
        case let .object(value): try c.encode(value)
        }
    }
}
