import Foundation

enum MealRole: String, Codable, Sendable {
    case regular
    case preWorkout = "pre_workout"
    case postWorkout = "post_workout"
    case bedtime
}

enum MealOptionKind: String, Codable, Sendable {
    /// Cook it yourself.
    case home
    /// Buy it ready to eat.
    case out
}

struct MealOption: Codable, Hashable, Identifiable, Sendable {
    struct Ingredient: Codable, Hashable, Sendable {
        var item: String
        var amount: String
    }

    var id: String
    var kind: MealOptionKind
    var name: String
    var summary: String
    /// Where to buy it, for kind `out`.
    var place: String?
    /// Exactly what to order or grab, for kind `out`.
    var order: String?
    var ingredients: [Ingredient]
    var steps: [String]
    var prepMinutes: Double
    var costUsd: Double
    var macros: Macros
}

struct MenuSlot: Codable, Hashable, Sendable {
    var dayType: DayType
    var slotIndex: Int
    var label: String
    var role: MealRole
    var targets: Macros
    var options: [MealOption]
}

struct GroceryItem: Codable, Hashable, Sendable {
    var item: String
    var quantity: String
    var section: String
    var costUsd: Double
}

enum PlanSource: String, Codable, Sendable {
    case coach
    case fallback
}

struct MealMenu: Codable, Hashable, Sendable {
    var id: Int
    var weekStart: LocalDate
    var createdAt: Timestamp
    var source: PlanSource
    var slots: [MenuSlot]
    var groceryList: [GroceryItem]
    var prepTips: [String]
    var coachNote: String
}

enum MealLogStatus: String, Codable, Sendable {
    case eaten
    case skipped
}

struct MealLog: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var date: LocalDate
    var slotIndex: Int?
    var optionId: String?
    var name: String
    var macros: Macros
    var status: MealLogStatus
    var loggedAt: Timestamp
}

struct MealLogRequest: Encodable, Sendable {
    struct Custom: Codable, Hashable, Sendable {
        var name: String
        var macros: Macros
    }

    var date: LocalDate
    var slotIndex: Int?
    var optionId: String?
    /// Required when `optionId` is nil and status is eaten.
    var custom: Custom?
    var status: MealLogStatus

    private enum CodingKeys: String, CodingKey { case date, slotIndex, optionId, custom, status }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(date, forKey: .date)
        try c.encode(slotIndex, forKey: .slotIndex)
        try c.encode(optionId, forKey: .optionId)
        try c.encode(custom, forKey: .custom)
        try c.encode(status, forKey: .status)
    }
}

struct MenuResponse: Codable, Sendable {
    var menu: MealMenu?
    var pendingJob: Job?
}

struct MealHistoryDay: Codable, Hashable, Sendable {
    var date: LocalDate
    var dayType: DayType
    var targets: Macros
    var consumed: Macros
    var logs: [MealLog]
}

/// `Job.result` for `estimate_meal`.
struct MealEstimate: Codable, Hashable, Sendable {
    var name: String
    var macros: Macros
}
