import SwiftUI

/// Colors, metrics and type used across the app. Surfaces come from the system palette so light mode
/// and increased contrast keep working; the accent and macro colors live here.
enum Theme {
    // Macro colors, used consistently in rings, bars and labels.
    static let kcal = Color.accentColor
    static let protein = Color(light: (0.0, 0.48, 0.75), dark: (0.35, 0.78, 0.98))
    static let carbs = Color(light: (0.78, 0.52, 0.0), dark: (1.0, 0.78, 0.28))
    static let fat = Color(light: (0.55, 0.30, 0.85), dark: (0.78, 0.52, 0.98))

    static let success = Color.green
    static let warning = Color.orange

    static let cardBackground = Color(.secondarySystemGroupedBackground)
    static let raisedBackground = Color(.tertiarySystemGroupedBackground)
    static let screenBackground = Color(.systemGroupedBackground)

    static let cornerRadius: CGFloat = 22
    static let smallRadius: CGFloat = 14
    static let padding: CGFloat = 16
    static let spacing: CGFloat = 12
    /// Minimum height for controls used mid-set.
    static let bigTap: CGFloat = 56

    static let spring = Animation.spring(response: 0.38, dampingFraction: 0.82)
    static let snappy = Animation.snappy(duration: 0.28)
}

extension View {
    /// The standard content card: a single rounded surface on the grouped background.
    func card(padding: CGFloat = Theme.padding) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    /// Tabular, rounded-feeling digits for numbers that change.
    func numeric() -> some View {
        self.monospacedDigit()
    }
}

extension Font {
    /// Numbers that scale with Dynamic Type: weights, reps, kcal.
    static func number(_ style: Font.TextStyle, weight: Font.Weight = .semibold) -> Font {
        .system(style, design: .rounded, weight: weight).monospacedDigit()
    }

    /// Fixed-size display numbers; pair with `@ScaledMetric` for Dynamic Type.
    static func number(size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded).monospacedDigit()
    }
}

extension Color {
    /// A color that adapts to light and dark appearance.
    init(light: (Double, Double, Double), dark: (Double, Double, Double)) {
        self.init(uiColor: UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
    }
}
