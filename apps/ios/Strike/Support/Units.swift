import Foundation

/// Converts between the wire units (kg, cm) and the profile's display units.
struct UnitSystem: Hashable, Sendable {
    static let kgPerLb = 0.45359237
    static let cmPerIn = 2.54

    var units: Units

    static let imperial = UnitSystem(units: .imperial)
    static let metric = UnitSystem(units: .metric)

    var isImperial: Bool { units == .imperial }
    var weightSymbol: String { isImperial ? "lb" : "kg" }
    var lengthSymbol: String { isImperial ? "in" : "cm" }
    var loadUnit: LoadUnit { isImperial ? .lb : .kg }

    // MARK: Body weight

    func weight(fromKg kg: Double) -> Double { isImperial ? kg / Self.kgPerLb : kg }
    func kg(fromWeight value: Double) -> Double { isImperial ? value * Self.kgPerLb : value }

    /// "182.4 lb"
    func formatWeight(kg: Double?, decimals: Int = 1) -> String {
        guard let kg else { return "—" }
        return "\(Fmt.number(weight(fromKg: kg), decimals: decimals)) \(weightSymbol)"
    }

    /// "−0.6 lb/wk"
    func formatRate(kgPerWeek: Double?) -> String {
        guard let kgPerWeek else { return "—" }
        let value = weight(fromKg: kgPerWeek)
        return "\(Fmt.signed(value, decimals: 1)) \(weightSymbol)/wk"
    }

    // MARK: Length

    func length(fromCm cm: Double) -> Double { isImperial ? cm / Self.cmPerIn : cm }
    func cm(fromLength value: Double) -> Double { isImperial ? value * Self.cmPerIn : value }

    func formatLength(cm: Double?) -> String {
        guard let cm else { return "—" }
        return "\(Fmt.number(length(fromCm: cm), decimals: 1)) \(lengthSymbol)"
    }

    /// "5′ 10″" or "178 cm"
    func formatHeight(cm: Double) -> String {
        guard isImperial else { return "\(Int(cm.rounded())) cm" }
        let totalInches = Int((cm / Self.cmPerIn).rounded())
        return "\(totalInches / 12)′ \(totalInches % 12)″"
    }
}

extension LoadUnit {
    var symbol: String { rawValue }
}

/// Number, money and macro formatting with stable, locale-aware output.
enum Fmt {
    static func number(_ value: Double, decimals: Int = 1) -> String {
        value.formatted(.number.precision(.fractionLength(0 ... decimals)).grouping(.automatic))
    }

    static func integer(_ value: Double) -> String {
        Int(value.rounded()).formatted(.number.grouping(.automatic))
    }

    static func signed(_ value: Double, decimals: Int = 1) -> String {
        let rounded = (value * pow(10, Double(decimals))).rounded() / pow(10, Double(decimals))
        if rounded == 0 { return number(0, decimals: decimals) }
        let body = number(abs(rounded), decimals: decimals)
        return rounded > 0 ? "+\(body)" : "−\(body)"
    }

    /// "52.5 lb", or "Bodyweight" when there's no load.
    static func load(_ weight: Double?, unit: LoadUnit) -> String {
        guard let weight else { return "Bodyweight" }
        return "\(number(weight, decimals: 2)) \(unit.symbol)"
    }

    /// "52.5" without unit; "BW" for bodyweight.
    static func loadValue(_ weight: Double?) -> String {
        guard let weight else { return "BW" }
        return number(weight, decimals: 2)
    }

    static func usd(_ value: Double) -> String {
        value.formatted(.currency(code: "USD").precision(.fractionLength(value.rounded() == value && value >= 10 ? 0 : 2)))
    }

    static func kcal(_ value: Double) -> String { "\(integer(value)) kcal" }
    static func grams(_ value: Double) -> String { "\(integer(value))g" }

    static func minutes(_ value: Double) -> String {
        let m = Int(value.rounded())
        if m < 60 { return "\(m) min" }
        return m % 60 == 0 ? "\(m / 60) h" : "\(m / 60) h \(m % 60) min"
    }

    /// "50 × 10"
    static func set(weight: Double?, reps: Int) -> String {
        weight == nil ? "\(reps) reps" : "\(loadValue(weight)) × \(reps)"
    }
}
