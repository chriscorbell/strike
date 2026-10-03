import Foundation

/// The screens of the onboarding flow. Editing a profile skips the body screens and the review.
enum OnboardingStep: String, Hashable, CaseIterable, Identifiable, Sendable {
    case about
    case body
    case goal
    case day
    case training
    case equipment
    case food
    case review

    var id: String { rawValue }

    var title: String {
        switch self {
        case .about: "About you"
        case .body: "Measurements"
        case .goal: "Goal"
        case .day: "Your day"
        case .training: "Training"
        case .equipment: "Equipment"
        case .food: "Food"
        case .review: "Review"
        }
    }

    var symbol: String {
        switch self {
        case .about: "person.fill"
        case .body: "ruler.fill"
        case .goal: "target"
        case .day: "sun.horizon.fill"
        case .training: "figure.strengthtraining.traditional"
        case .equipment: "dumbbell.fill"
        case .food: "fork.knife"
        case .review: "checklist"
        }
    }

    static func steps(for mode: OnboardingFlow.Mode) -> [OnboardingStep] {
        switch mode {
        case .initial: allCases
        case .edit: [.about, .goal, .day, .training, .equipment, .food]
        }
    }
}

/// Everything the onboarding screens edit: the profile itself plus the first weigh-in and tape
/// measurements, which only the first onboarding sends. Body values stay in kg and cm (the wire
/// units); training loads are in the profile's load unit.
struct OnboardingDraft: Hashable, Sendable {
    var profile: Profile
    var weightKg: Double?
    var measurements: Measurements

    /// A first-run draft with defaults that suit a male intermediate lifter with an apartment gym
    /// and a few things at home.
    static func initial(timezone: String = TimeZone.current.identifier) -> OnboardingDraft {
        let profile = Profile(
            name: "",
            sex: .male,
            birthDate: "1990-01-01",
            heightCm: heightCm(inches: 70),
            units: .imperial,
            timezone: timezone,
            activityLevel: .light,
            goal: .init(type: .lose, ratePercentPerWeek: 0.5, targetWeightKg: nil),
            training: .init(
                experience: .intermediate,
                days: [1, 2, 4, 5],
                sessionMinutes: 60,
                workoutTime: "18:00",
                defaultLocation: .gym,
                focusMuscles: [],
                limitations: ""
            ),
            equipment: defaultEquipment(for: .lb),
            schedule: .init(wakeTime: "07:00", sleepTime: "23:00", checkInDay: 0),
            nutrition: .init(
                mealsPerDay: 4,
                dietStyle: .omnivore,
                allergies: [],
                avoidFoods: "",
                favoriteFoods: "",
                cookingTime: .moderate,
                weeklyBudgetUsd: 100,
                grabAndGo: [],
                kitchen: [.microwave, .stove, .oven, .airFryer, .riceCooker]
            )
        )
        return OnboardingDraft(profile: profile, weightKg: 180 * UnitSystem.kgPerLb, measurements: .empty)
    }

    /// A draft for editing a saved profile. Weight and measurements are logged in Progress instead.
    init(editing profile: Profile) {
        self.init(profile: profile, weightKg: nil, measurements: .empty)
    }

    init(profile: Profile, weightKg: Double?, measurements: Measurements) {
        self.profile = profile
        self.weightKg = weightKg
        self.measurements = measurements
    }

    var units: UnitSystem { UnitSystem(units: profile.units) }
    var loadUnit: LoadUnit { profile.loadUnit }

    // MARK: Equipment defaults and units

    static func defaultEquipment(for unit: LoadUnit) -> Profile.Equipment {
        let gymItems: [EquipmentItem] = [
            .benchFlat, .benchAdjustable, .cable, .latPulldown, .seatedRow, .legPress, .legExtension, .legCurl,
            .smithMachine, .chestPressMachine, .pecDeck,
        ]
        switch unit {
        case .lb:
            return .init(
                home: .init(available: true, dumbbells: .adjustable(min: 5, max: 52.5, step: 2.5), items: [.benchAdjustable], machineStep: 5, notes: ""),
                gym: .init(available: true, dumbbells: .fixed(weights: stride(from: 5.0, through: 75, by: 5).map { $0 }), items: gymItems, machineStep: 10, notes: "")
            )
        case .kg:
            return .init(
                home: .init(available: true, dumbbells: .adjustable(min: 2, max: 24, step: 2), items: [.benchAdjustable], machineStep: 2.5, notes: ""),
                gym: .init(available: true, dumbbells: .fixed(weights: stride(from: 2.5, through: 35, by: 2.5).map { $0 }), items: gymItems, machineStep: 5, notes: "")
            )
        }
    }

    /// Switches display units. Body values are stored in kg and cm so they just display differently;
    /// equipment loads are converted, or swapped for the other unit's defaults if still untouched.
    mutating func setUnits(_ units: Units) {
        guard units != profile.units else { return }
        let from = profile.loadUnit
        profile.units = units
        let to = profile.loadUnit
        if profile.equipment == Self.defaultEquipment(for: from) {
            profile.equipment = Self.defaultEquipment(for: to)
            return
        }
        for location in Location.allCases {
            var equipment = profile.equipment[location]
            equipment.dumbbells = Self.convert(equipment.dumbbells, from: from, to: to)
            equipment.machineStep = Self.convertLoad(equipment.machineStep, from: from, to: to)
            profile.equipment[location] = equipment
        }
    }

    /// Converts a load between lb and kg, rounded to the nearest half unit.
    static func convertLoad(_ value: Double, from: LoadUnit, to: LoadUnit) -> Double {
        guard from != to else { return value }
        let raw = from == .lb ? value * UnitSystem.kgPerLb : value / UnitSystem.kgPerLb
        return max(0.5, (raw * 2).rounded() / 2)
    }

    static func convert(_ set: DumbbellSet, from: LoadUnit, to: LoadUnit) -> DumbbellSet {
        switch set {
        case .none:
            return .none
        case let .adjustable(min, max, step):
            return .adjustable(min: convertLoad(min, from: from, to: to), max: convertLoad(max, from: from, to: to), step: convertLoad(step, from: from, to: to))
        case let .fixed(weights):
            return .fixed(weights: Array(Set(weights.map { convertLoad($0, from: from, to: to) })).sorted())
        }
    }

    // MARK: Goal

    static func ratePresets(for goal: GoalType) -> [Double] {
        switch goal {
        case .lose: [0.25, 0.5, 0.75, 1.0]
        case .maintain: []
        case .gain: [0.1, 0.25, 0.5]
        }
    }

    static func defaultRate(for goal: GoalType) -> Double {
        switch goal {
        case .lose: 0.5
        case .maintain: 0
        case .gain: 0.25
        }
    }

    /// Presets for the current goal, plus the saved rate when it isn't one of them.
    var rateOptions: [Double] {
        let presets = Self.ratePresets(for: profile.goal.type)
        guard !presets.isEmpty else { return [] }
        let current = profile.goal.ratePercentPerWeek
        if current > 0, !presets.contains(current) { return (presets + [current]).sorted() }
        return presets
    }

    mutating func setGoal(_ type: GoalType) {
        guard type != profile.goal.type else { return }
        profile.goal.type = type
        if !Self.ratePresets(for: type).contains(profile.goal.ratePercentPerWeek) {
            profile.goal.ratePercentPerWeek = Self.defaultRate(for: type)
        }
    }

    // MARK: Wire

    /// The profile as it goes to the server. Only the name is cleaned up here: the controls already
    /// keep lists sorted and unique, and the server compares the stored JSON to decide whether to
    /// rebuild the training block or menu, so untouched fields must go back byte for byte.
    var normalizedProfile: Profile {
        var p = profile
        p.name = p.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return p
    }

    /// Height from whole inches, rounded to a millimeter so it round-trips cleanly.
    static func heightCm(inches: Int) -> Double {
        (Double(inches) * UnitSystem.cmPerIn * 10).rounded() / 10
    }

    /// Trims, drops blanks and removes case-insensitive duplicates, keeping the first spelling.
    static func cleaned(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { raw in
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value.lowercased()).inserted else { return nil }
            return value
        }
    }

    var onboardingRequest: OnboardingRequest {
        var m = measurements
        func round(_ value: Double?) -> Double? { value.map { ($0 * 10).rounded() / 10 } }
        m.waistCm = round(m.waistCm)
        m.neckCm = round(m.neckCm)
        m.hipsCm = round(m.hipsCm)
        m.chestCm = round(m.chestCm)
        m.armCm = round(m.armCm)
        m.thighCm = round(m.thighCm)
        m.bodyFatPercent = round(m.bodyFatPercent)
        let weight = ((weightKg ?? 0) * 100).rounded() / 100
        return OnboardingRequest(profile: normalizedProfile, weightKg: weight, measurements: m.isEmpty ? nil : m)
    }

    // MARK: Validation (mirrors the zod schemas in packages/core/src/schemas.ts)

    static let heightRangeCm: ClosedRange<Double> = 120 ... 230
    static let weightRangeKg: ClosedRange<Double> = 30 ... 300
    static let sessionMinutesRange: ClosedRange<Int> = 20 ... 120
    static let trainingDaysRange: ClosedRange<Int> = 2 ... 6
    static let mealsRange: ClosedRange<Int> = 3 ... 6
    static let focusLimit = 4

    /// The first thing blocking `step`, phrased for the user, or nil when it's ready.
    func issue(for step: OnboardingStep, mode: OnboardingFlow.Mode) -> String? {
        switch step {
        case .about:
            if profile.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Add your name." }
            if !Self.heightRangeCm.contains(profile.heightCm) {
                return units.isImperial ? "Height should be between 4′ 0″ and 7′ 6″." : "Height should be between 120 and 230 cm."
            }
            if mode == .initial {
                guard let weightKg else { return "Add your current weight." }
                if !Self.weightRangeKg.contains(weightKg) {
                    let low = Fmt.integer(units.weight(fromKg: Self.weightRangeKg.lowerBound))
                    let high = Fmt.integer(units.weight(fromKg: Self.weightRangeKg.upperBound))
                    return "Weight should be between \(low) and \(high) \(units.weightSymbol)."
                }
            }
            return nil
        case .body:
            let lengths = [measurements.waistCm, measurements.neckCm, measurements.hipsCm, measurements.chestCm, measurements.armCm, measurements.thighCm]
            if lengths.contains(where: { ($0 ?? 1) <= 0 }) { return "Measurements need to be above zero." }
            if let bodyFat = measurements.bodyFatPercent, !(3 ... 60).contains(bodyFat) { return "Body fat should be between 3 and 60%." }
            return nil
        case .goal:
            if !(0 ... 1.5).contains(profile.goal.ratePercentPerWeek) { return "Pick a weekly rate." }
            if let target = profile.goal.targetWeightKg, !Self.weightRangeKg.contains(target) {
                return "That target weight looks off."
            }
            return nil
        case .day:
            return nil
        case .training:
            let days = Set(profile.training.days).count
            if !Self.trainingDaysRange.contains(days) { return "Pick 2 to 6 training days." }
            if !Self.sessionMinutesRange.contains(profile.training.sessionMinutes) { return "Sessions run 20 to 120 minutes." }
            if profile.training.focusMuscles.count > Self.focusLimit { return "Pick up to 4 focus muscles." }
            return nil
        case .equipment:
            for location in Location.allCases {
                if let issue = equipmentIssue(at: location) { return issue }
            }
            return nil
        case .food:
            if !Self.mealsRange.contains(profile.nutrition.mealsPerDay) { return "Pick 3 to 6 meals a day." }
            if profile.nutrition.weeklyBudgetUsd < 0 { return "Budget can't be negative." }
            return nil
        case .review:
            for other in OnboardingStep.steps(for: mode) where other != .review {
                if let issue = issue(for: other, mode: mode) { return issue }
            }
            return nil
        }
    }

    func equipmentIssue(at location: Location) -> String? {
        let equipment = profile.equipment[location]
        let place = location.displayName.lowercased()
        if location == profile.training.defaultLocation, !equipment.available {
            return "You usually train at the \(place), so it needs to be available."
        }
        switch equipment.dumbbells {
        case .none:
            break
        case let .adjustable(min, max, step):
            if min <= 0 || max <= 0 || step <= 0 { return "Dumbbell weights at the \(place) need to be above zero." }
            if max < min { return "The heaviest \(place) dumbbell is lighter than the lightest." }
        case let .fixed(weights):
            if weights.isEmpty { return "Add at least one dumbbell weight at the \(place)." }
            if weights.contains(where: { $0 <= 0 }) { return "Dumbbell weights at the \(place) need to be above zero." }
        }
        if equipment.machineStep <= 0 { return "The machine step at the \(place) needs to be above zero." }
        return nil
    }

    // MARK: Edit side effects (mirrors updateProfile in apps/server/src/services/onboarding.ts)

    /// What the server will redo when this draft replaces `original`.
    func saveEffects(comparedTo original: Profile) -> [OnboardingSaveEffect] {
        let next = normalizedProfile
        var effects: [OnboardingSaveEffect] = []
        let energyChanged = next.goal != original.goal
            || next.activityLevel != original.activityLevel
            || next.training.sessionMinutes != original.training.sessionMinutes
            || next.sex != original.sex
            || next.heightCm != original.heightCm
            || next.birthDate != original.birthDate
        if energyChanged { effects.append(.targets) }
        if next.training.days.count != original.training.days.count
            || next.equipment != original.equipment
            || next.training.experience != original.training.experience {
            effects.append(.trainingBlock)
        }
        if next.nutrition != original.nutrition
            || next.schedule.wakeTime != original.schedule.wakeTime
            || next.schedule.sleepTime != original.schedule.sleepTime
            || next.training.workoutTime != original.training.workoutTime
            || next.training.days != original.training.days {
            effects.append(.menu)
        }
        return effects
    }
}

enum OnboardingSaveEffect: String, Identifiable, Sendable {
    case targets
    case trainingBlock
    case menu

    var id: String { rawValue }

    var text: String {
        switch self {
        case .targets: "Recalculates your calorie and macro targets"
        case .trainingBlock: "Starts a new training block from your next session"
        case .menu: "Rewrites this week's menu"
        }
    }

    var symbol: String {
        switch self {
        case .targets: "flame.fill"
        case .trainingBlock: "calendar.badge.plus"
        case .menu: "fork.knife"
        }
    }
}

// MARK: - Summaries

extension OnboardingDraft {
    /// One line per step for the profile editor's list.
    func summary(for step: OnboardingStep) -> String {
        let p = profile
        switch step {
        case .about:
            let name = p.name.trimmingCharacters(in: .whitespacesAndNewlines)
            return [name.isEmpty ? nil : name, units.formatHeight(cm: p.heightCm), p.units == .imperial ? "Imperial" : "Metric"]
                .compactMap(\.self).joined(separator: " · ")
        case .body:
            return measurements.isEmpty ? "Skipped" : "Added"
        case .goal:
            return p.goal.type == .maintain ? p.goal.type.displayName : "\(p.goal.type.displayName) · \(Self.rateText(p.goal.ratePercentPerWeek)) a week"
        case .day:
            return "\(p.activityLevel.displayName) · \(Dates.display(p.schedule.wakeTime))–\(Dates.display(p.schedule.sleepTime))"
        case .training:
            return "\(Set(p.training.days).count) days · \(p.training.sessionMinutes) min · \(p.training.defaultLocation.displayName)"
        case .equipment:
            let places = Location.allCases.filter { p.equipment[$0].available }.map(\.displayName)
            return places.isEmpty ? "Nothing available" : places.joined(separator: " and ")
        case .food:
            return "\(p.nutrition.mealsPerDay) meals · \(p.nutrition.dietStyle.displayName) · \(Fmt.usdWhole(p.nutrition.weeklyBudgetUsd)) a week"
        case .review:
            return ""
        }
    }

    static func rateText(_ percent: Double) -> String {
        "\(Fmt.number(percent, decimals: 2))%"
    }

    /// "0.9 lb", the weekly change a rate means at `weightKg`.
    func weeklyChange(rate: Double, weightKg: Double) -> String {
        let value = units.weight(fromKg: weightKg * rate / 100)
        return "\(Fmt.number(value, decimals: value < 1 ? 2 : 1)) \(units.weightSymbol)"
    }

    func dumbbellSummary(_ set: DumbbellSet) -> String {
        let unit = loadUnit.symbol
        switch set {
        case .none:
            return "No dumbbells"
        case let .adjustable(min, max, step):
            return "Adjustable \(Fmt.number(min, decimals: 2))–\(Fmt.number(max, decimals: 2)) \(unit), \(Fmt.number(step, decimals: 2)) \(unit) steps"
        case let .fixed(weights):
            let sorted = weights.sorted()
            guard let first = sorted.first, let last = sorted.last else { return "No weights yet" }
            let pairs = sorted.count == 1 ? "1 pair" : "\(sorted.count) pairs"
            return first == last ? "\(pairs), \(Fmt.number(first, decimals: 2)) \(unit)" : "\(pairs), \(Fmt.number(first, decimals: 2))–\(Fmt.number(last, decimals: 2)) \(unit)"
        }
    }

    static func weekdayList(_ days: [Weekday]) -> String {
        let set = Set(days)
        return Dates.orderedWeekdays.filter { set.contains($0) }.map { Dates.shortWeekdays[$0] }.joined(separator: ", ")
    }
}
