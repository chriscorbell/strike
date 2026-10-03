import Foundation

// Human-facing names for the contract's enums.

extension Muscle {
    var displayName: String {
        switch self {
        case .chest: "Chest"
        case .back: "Back"
        case .traps: "Traps"
        case .frontDelts: "Front delts"
        case .sideDelts: "Side delts"
        case .rearDelts: "Rear delts"
        case .biceps: "Biceps"
        case .triceps: "Triceps"
        case .forearms: "Forearms"
        case .quads: "Quads"
        case .hamstrings: "Hamstrings"
        case .glutes: "Glutes"
        case .calves: "Calves"
        case .abs: "Abs"
        }
    }
}

extension Location {
    var displayName: String { self == .home ? "Home" : "Gym" }
    var symbol: String { self == .home ? "house.fill" : "dumbbell.fill" }
}

extension EquipmentItem {
    var displayName: String {
        switch self {
        case .benchFlat: "Flat bench"
        case .benchAdjustable: "Adjustable bench"
        case .pullupBar: "Pull-up bar"
        case .dipStation: "Dip station"
        case .cable: "Cable station"
        case .latPulldown: "Lat pulldown"
        case .seatedRow: "Seated row"
        case .legPress: "Leg press"
        case .legExtension: "Leg extension"
        case .legCurl: "Leg curl"
        case .smithMachine: "Smith machine"
        case .barbell: "Barbell and plates"
        case .chestPressMachine: "Chest press machine"
        case .shoulderPressMachine: "Shoulder press machine"
        case .pecDeck: "Pec deck"
        }
    }
}

extension LoadType {
    var displayName: String {
        switch self {
        case .dumbbell: "Dumbbell"
        case .barbell: "Barbell"
        case .smith: "Smith machine"
        case .cable: "Cable"
        case .machine: "Machine"
        case .plateMachine: "Plate-loaded"
        case .bodyweight: "Bodyweight"
        }
    }
}

extension MealRole {
    var displayName: String? {
        switch self {
        case .regular: nil
        case .preWorkout: "Pre-workout"
        case .postWorkout: "Post-workout"
        case .bedtime: "Before bed"
        }
    }
}

extension DayType {
    var displayName: String { self == .training ? "Training day" : "Rest day" }
    var shortName: String { self == .training ? "Training" : "Rest" }
}

extension SessionStatus {
    var displayName: String {
        switch self {
        case .planned: "Planned"
        case .inProgress: "In progress"
        case .completed: "Done"
        case .skipped: "Skipped"
        }
    }
}

extension Sex {
    var displayName: String { self == .male ? "Male" : "Female" }
}

extension ActivityLevel {
    var displayName: String {
        switch self {
        case .sedentary: "Sedentary"
        case .light: "Light"
        case .moderate: "Moderate"
        case .active: "Active"
        case .veryActive: "Very active"
        }
    }

    var detail: String {
        switch self {
        case .sedentary: "Desk job, under 5k steps"
        case .light: "Mostly sitting, 5–8k steps"
        case .moderate: "On your feet often, 8–11k steps"
        case .active: "Physical job or 11–15k steps"
        case .veryActive: "Hard labor or 15k+ steps"
        }
    }
}

extension GoalType {
    var displayName: String {
        switch self {
        case .lose: "Lose fat"
        case .maintain: "Maintain"
        case .gain: "Build muscle"
        }
    }
}

extension Experience {
    var displayName: String { rawValue.capitalized }

    var detail: String {
        switch self {
        case .beginner: "Under a year of consistent lifting"
        case .intermediate: "1–4 years"
        case .advanced: "4+ years, close to your limits"
        }
    }
}

extension DietStyle {
    var displayName: String { rawValue.capitalized }
}

extension CookingTime {
    var displayName: String {
        switch self {
        case .minimal: "Minimal"
        case .moderate: "Some"
        case .enjoys: "Enjoy it"
        }
    }

    var detail: String {
        switch self {
        case .minimal: "Under 15 minutes"
        case .moderate: "15–30 minutes"
        case .enjoys: "Happy to spend time"
        }
    }
}

extension KitchenItem {
    var displayName: String {
        switch self {
        case .microwave: "Microwave"
        case .stove: "Stove"
        case .oven: "Oven"
        case .airFryer: "Air fryer"
        case .riceCooker: "Rice cooker"
        case .blender: "Blender"
        case .slowCooker: "Slow cooker"
        case .grill: "Grill"
        }
    }
}

extension JobKind {
    /// What the coach is doing, for progress indicators.
    var activity: String {
        switch self {
        case .mesocycle: "Writing your training block"
        case .mealMenu: "Writing this week's menu"
        case .checkInNote: "Reviewing your week"
        case .moreOptions: "Finding more meal options"
        case .estimateMeal: "Estimating your meal"
        }
    }
}

/// Soreness, pump and workload answers for `MuscleFeedback`.
enum FeedbackScale {
    static let soreness = ["Never sore", "Healed a while ago", "Healed just in time", "Still sore"]
    static let pump = ["Low", "Moderate", "Amazing"]
    static let workload = ["Easy", "Just right", "Hard", "Too much"]
}
