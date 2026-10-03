import Foundation

enum Sex: String, Codable, CaseIterable, Identifiable, Sendable {
    case male
    case female

    var id: String { rawValue }
}

enum ActivityLevel: String, Codable, CaseIterable, Identifiable, Sendable {
    case sedentary
    case light
    case moderate
    case active
    case veryActive = "very_active"

    var id: String { rawValue }
}

enum GoalType: String, Codable, CaseIterable, Identifiable, Sendable {
    case lose
    case maintain
    case gain

    var id: String { rawValue }
}

enum Experience: String, Codable, CaseIterable, Identifiable, Sendable {
    case beginner
    case intermediate
    case advanced

    var id: String { rawValue }
}

enum DietStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    case omnivore
    case pescatarian
    case vegetarian
    case vegan

    var id: String { rawValue }
}

enum CookingTime: String, Codable, CaseIterable, Identifiable, Sendable {
    case minimal
    case moderate
    case enjoys

    var id: String { rawValue }
}

enum KitchenItem: String, Codable, CaseIterable, Identifiable, Sendable {
    case microwave
    case stove
    case oven
    case airFryer = "air_fryer"
    case riceCooker = "rice_cooker"
    case blender
    case slowCooker = "slow_cooker"
    case grill

    var id: String { rawValue }
}

struct Profile: Codable, Hashable, Sendable {
    struct Goal: Codable, Hashable, Sendable {
        var type: GoalType
        /// Percent of body weight per week; ignored for maintain.
        var ratePercentPerWeek: Double
        var targetWeightKg: Double?

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(type, forKey: .type)
            try c.encode(ratePercentPerWeek, forKey: .ratePercentPerWeek)
            try c.encode(targetWeightKg, forKey: .targetWeightKg)
        }
    }

    struct Training: Codable, Hashable, Sendable {
        var experience: Experience
        /// Weekdays you lift, 2 to 6 of them.
        var days: [Weekday]
        var sessionMinutes: Int
        var workoutTime: TimeOfDay
        var defaultLocation: Location
        var focusMuscles: [Muscle]
        var limitations: String
    }

    struct Equipment: Codable, Hashable, Sendable {
        var home: LocationEquipment
        var gym: LocationEquipment

        subscript(location: Location) -> LocationEquipment {
            get { location == .home ? home : gym }
            set {
                if location == .home { home = newValue } else { gym = newValue }
            }
        }
    }

    struct Schedule: Codable, Hashable, Sendable {
        var wakeTime: TimeOfDay
        var sleepTime: TimeOfDay
        /// The first day of each plan week. The check-in and next week's meal plan are prepared ahead of it.
        var checkInDay: Weekday
        /// Grocery day for the coming plan week; nil means the day before the week starts. Optional on
        /// the wire, so nil is omitted rather than sent as null.
        var shoppingDay: Weekday?

        /// The grocery day in effect.
        var effectiveShoppingDay: Weekday { shoppingDay ?? (checkInDay + 6) % 7 }
    }

    struct Nutrition: Codable, Hashable, Sendable {
        var mealsPerDay: Int
        var dietStyle: DietStyle
        var allergies: [String]
        var avoidFoods: String
        var favoriteFoods: String
        var cookingTime: CookingTime
        var weeklyBudgetUsd: Double
        var grabAndGo: [String]
        var kitchen: [KitchenItem]
    }

    var name: String
    var sex: Sex
    var birthDate: LocalDate
    var heightCm: Double
    /// Imperial shows lb/in and loads in lb; metric shows kg/cm and loads in kg.
    var units: Units
    var timezone: String
    /// Activity outside of lifting: job, steps, chores.
    var activityLevel: ActivityLevel
    var goal: Goal
    var training: Training
    var equipment: Equipment
    var schedule: Schedule
    var nutrition: Nutrition

    var loadUnit: LoadUnit { units == .imperial ? .lb : .kg }
}
