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
        /// As written in the recipe, e.g. "1 1/2 cups (340 g)".
        var amount: String
        /// The grocery item it's bought as, for totaling the week's shopping.
        var groceryId: String?
        /// Amount in that grocery item's unit, as purchased.
        var quantity: Double?
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

/// One thing to buy, totaled from the planned meals.
struct GroceryItem: Codable, Hashable, Sendable {
    var item: String
    /// What to buy, e.g. "2 x 32 oz tub".
    var quantity: String
    /// How much the plan uses, e.g. "about 3.4 lb"; nil when untracked.
    var needed: String?
    var section: String
    var costUsd: Double
    /// A pantry item most kitchens already have: check before buying.
    var staple: Bool
}

/// The planned dish for each meal of one day.
struct PlanDay: Codable, Hashable, Sendable {
    struct Meal: Codable, Hashable, Sendable {
        var slotIndex: Int
        var optionId: String
    }

    var date: LocalDate
    var dayType: DayType
    var meals: [Meal]
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
    /// One entry per remaining day of the week; empty on menus from before planning.
    var plan: [PlanDay]
    /// Totaled from the plan's home-cooked meals.
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

/// `PUT /api/menu/:id/plan`.
struct PlanMealRequest: Encodable, Sendable {
    var date: LocalDate
    var slotIndex: Int
    var optionId: String
}

/// `POST /api/menu/regenerate`.
struct RegenerateMenuRequest: Encodable, Sendable {
    var note: String?
    var week: MenuWeek
}

enum MenuWeek: String, Codable, CaseIterable, Identifiable, Sendable {
    case current
    case next

    var id: String { rawValue }
}

struct MenuResponse: Codable, Sendable {
    struct PrepAt: Codable, Hashable, Sendable {
        var date: LocalDate
        var time: TimeOfDay
    }

    var menu: MealMenu?
    var pendingJob: Job?
    /// When this week's plan is prepared, e.g. Friday 18:00.
    var prepAt: PrepAt
    var shoppingDate: LocalDate
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
