import SwiftUI
import UIKit

// Controls shared by the onboarding screens.

// MARK: - Bindings

enum OnboardingBind {
    /// A `Date` for a DatePicker, backed by an `"HH:MM"` string.
    static func time(_ value: Binding<TimeOfDay>) -> Binding<Date> {
        Binding {
            Dates.date(at: value.wrappedValue) ?? .now
        } set: { date in
            value.wrappedValue = Dates.timeOfDay(from: date)
        }
    }

    /// A `Date` for a DatePicker, backed by a `"YYYY-MM-DD"` string.
    static func day(_ value: Binding<LocalDate>) -> Binding<Date> {
        Binding {
            Dates.date(from: value.wrappedValue) ?? .now
        } set: { date in
            value.wrappedValue = Dates.localDate(from: date)
        }
    }

    /// An optional view of a required number: clearing the field keeps the last value.
    static func required(_ value: Binding<Double>) -> Binding<Double?> {
        Binding {
            value.wrappedValue
        } set: { newValue in
            if let newValue { value.wrappedValue = newValue }
        }
    }

    /// Converts between a stored value and the value shown, e.g. kg stored and lb shown.
    static func converted(
        _ value: Binding<Double?>,
        toDisplay: @escaping @Sendable (Double) -> Double,
        fromDisplay: @escaping @Sendable (Double) -> Double
    ) -> Binding<Double?> {
        Binding {
            value.wrappedValue.map(toDisplay)
        } set: { newValue in
            value.wrappedValue = newValue.map(fromDisplay)
        }
    }
}

enum OnboardingKeyboard {
    @MainActor static func dismiss() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

// MARK: - Number field

/// A form row with a trailing numeric text field and its unit, e.g. "Weight   180 lb".
struct OnboardingNumberField: View {
    var title: String
    @Binding var value: Double?
    var unit: String? = nil
    var prefix: String? = nil
    var decimals = 1
    var placeholder = "—"

    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        LabeledContent {
            HStack(spacing: 4) {
                if let prefix {
                    Text(prefix)
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
                TextField(placeholder, text: $text)
                    .keyboardType(decimals > 0 ? .decimalPad : .numberPad)
                    .multilineTextAlignment(.trailing)
                    .focused($focused)
                    .accessibilityLabel(unit.map { "\(title), \(Self.spoken($0))" } ?? title)
                if let unit {
                    Text(unit)
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
            }
            .monospacedDigit()
        } label: {
            Text(title)
        }
        .onAppear { text = Self.format(value, decimals: decimals) }
        .onChange(of: text) { _, newText in
            let parsed = Self.parse(newText)
            if !Self.same(parsed, value) { value = parsed }
        }
        .onChange(of: value) { _, newValue in
            // While typing, only an outside change (e.g. a reset after adding) rewrites the text.
            if !focused || !Self.same(Self.parse(text), newValue) {
                text = Self.format(newValue, decimals: decimals)
            }
        }
        .onChange(of: focused) { _, isFocused in
            if !isFocused { text = Self.format(value, decimals: decimals) }
        }
    }

    static func format(_ value: Double?, decimals: Int) -> String {
        guard let value else { return "" }
        return value.formatted(.number.precision(.fractionLength(0 ... decimals)).grouping(.never))
    }

    static func parse(_ text: String) -> Double? {
        let locale = Locale.current
        var cleaned = text.trimmingCharacters(in: .whitespaces)
        if let grouping = locale.groupingSeparator, !grouping.isEmpty, grouping != locale.decimalSeparator {
            cleaned = cleaned.replacingOccurrences(of: grouping, with: "")
        }
        if let decimal = locale.decimalSeparator, decimal != "." {
            cleaned = cleaned.replacingOccurrences(of: decimal, with: ".")
        }
        return Double(cleaned)
    }

    private static func same(_ a: Double?, _ b: Double?) -> Bool {
        switch (a, b) {
        case (nil, nil): true
        case let (a?, b?): abs(a - b) <= max(1e-9, abs(b) * 1e-9)
        default: false
        }
    }

    private static func spoken(_ unit: String) -> String {
        switch unit {
        case "lb": "pounds"
        case "kg": "kilograms"
        case "in": "inches"
        case "cm": "centimeters"
        case "%": "percent"
        default: unit
        }
    }
}

// MARK: - Flow layout

/// Lays out children left to right, wrapping onto new lines.
struct OnboardingFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + lineSpacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for item in row.items {
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y + (row.height - item.size.height) / 2),
                    proposal: ProposedViewSize(item.size)
                )
                x += item.size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var items: [(index: Int, size: CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            var size = subviews[index].sizeThatFits(.unspecified)
            if size.width > maxWidth {
                size = subviews[index].sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
                size.width = min(size.width, maxWidth)
            }
            let needed = row.items.isEmpty ? size.width : row.width + spacing + size.width
            if !row.items.isEmpty, needed > maxWidth {
                rows.append(row)
                row = Row()
            }
            row.width = row.items.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.items.append((index, size))
        }
        if !row.items.isEmpty { rows.append(row) }
        return rows
    }
}

// MARK: - Chips

/// A capsule toggle used in multi-select groups.
struct OnboardingChip: View {
    var title: String
    var isSelected: Bool
    var isEnabled = true
    /// Shows an × to signal that tapping removes the chip.
    var removable = false
    var accessibilityTitle: String? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                    .lineLimit(1)
                if removable {
                    Image(systemName: "xmark")
                        .font(.caption2.weight(.bold))
                        .opacity(0.8)
                }
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 14)
            .frame(minHeight: 38)
            .foregroundStyle(isSelected ? Color.white : Color.primary)
            .background(
                isSelected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(Color(.tertiarySystemFill)),
                in: .capsule
            )
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.4)
        .accessibilityLabel(accessibilityTitle ?? title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityHint(removable ? "Removes it" : "")
    }
}

/// Wrapping multi-select chips over a fixed set of items, optionally capped.
struct OnboardingChipPicker<Item: Hashable>: View {
    var items: [Item]
    @Binding var selection: [Item]
    var limit: Int? = nil
    var title: (Item) -> String

    var body: some View {
        OnboardingFlowLayout {
            ForEach(items, id: \.self) { item in
                let selected = selection.contains(item)
                OnboardingChip(title: title(item), isSelected: selected, isEnabled: selected || !isFull) {
                    withAnimation(Theme.snappy) { toggle(item) }
                }
            }
        }
        .padding(.vertical, 6)
        .sensoryFeedback(.selection, trigger: selection)
    }

    private var isFull: Bool {
        guard let limit else { return false }
        return selection.count >= limit
    }

    private func toggle(_ item: Item) {
        var set = Set(selection)
        if set.contains(item) {
            set.remove(item)
        } else if !isFull {
            set.insert(item)
        }
        selection = items.filter { set.contains($0) }
    }
}

/// Equal-width single-choice tiles, e.g. the goal or a weekly rate.
struct OnboardingTiles<Value: Hashable>: View {
    struct Option {
        var value: Value
        var title: String
        var subtitle: String? = nil
        var systemImage: String? = nil
        var accessibilityLabel: String? = nil
    }

    var options: [Option]
    @Binding var selection: Value

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
            ForEach(options, id: \.value) { option in
                tile(option)
            }
        }
        .padding(.vertical, 6)
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func tile(_ option: Option) -> some View {
        let selected = option.value == selection
        return Button {
            withAnimation(Theme.snappy) { selection = option.value }
        } label: {
            VStack(spacing: 4) {
                if let systemImage = option.systemImage {
                    Image(systemName: systemImage)
                        .font(.title3.weight(.semibold))
                        .symbolRenderingMode(.hierarchical)
                }
                Text(option.title)
                    .font(.subheadline.weight(.semibold))
                if let subtitle = option.subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(selected ? Color.white.opacity(0.85) : Color.secondary)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .monospacedDigit()
            .padding(.horizontal, 6)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: 56)
            .foregroundStyle(selected ? Color.white : Color.primary)
            .background(
                selected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(Color(.tertiarySystemFill)),
                in: .rect(cornerRadius: 14, style: .continuous)
            )
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(option.accessibilityLabel ?? [option.title, option.subtitle].compactMap(\.self).joined(separator: ", "))
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Weekdays

/// Seven toggles ordered from the locale's first weekday.
struct OnboardingWeekdayPicker: View {
    @Binding var days: [Weekday]
    var maxCount = 6

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(OnboardingFlowLayout()) : AnyLayout(HStackLayout(spacing: 6))
        layout {
            ForEach(Dates.orderedWeekdays, id: \.self) { day in
                dayButton(day)
            }
        }
        .padding(.vertical, 6)
        .sensoryFeedback(.selection, trigger: days)
    }

    private func dayButton(_ day: Weekday) -> some View {
        let selected = days.contains(day)
        let enabled = selected || Set(days).count < maxCount
        return Button {
            withAnimation(Theme.snappy) {
                if selected {
                    days.removeAll { $0 == day }
                } else if enabled {
                    days = (days + [day]).sorted()
                }
            }
        } label: {
            Text(Dates.shortWeekdays[day])
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .padding(.horizontal, typeSize.isAccessibilitySize ? 14 : 0)
                .frame(maxWidth: typeSize.isAccessibilitySize ? nil : .infinity, minHeight: 44)
                .foregroundStyle(selected ? Color.white : Color.primary)
                .background(
                    selected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(Color(.tertiarySystemFill)),
                    in: .rect(cornerRadius: 12, style: .continuous)
                )
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityLabel(Dates.weekdays[day])
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: - Tokens

/// Free-form tags with tappable suggestions: a field to add one, then chips to toggle or remove.
struct OnboardingTokenEditor: View {
    @Binding var tokens: [String]
    var suggestions: [String]
    var placeholder: String

    @State private var entry = ""
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 8) {
            TextField(placeholder, text: $entry)
                .focused($focused)
                .submitLabel(.done)
                .onSubmit(add)
            if !trimmedEntry.isEmpty {
                Button("Add", systemImage: "plus.circle.fill", action: add)
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .buttonStyle(.borderless)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(Theme.snappy, value: trimmedEntry.isEmpty)

        if !chips.isEmpty {
            OnboardingFlowLayout {
                ForEach(chips, id: \.self) { chip in
                    let custom = !isSuggestion(chip)
                    OnboardingChip(title: chip, isSelected: contains(chip), removable: custom) {
                        withAnimation(Theme.snappy) { toggle(chip) }
                    }
                }
            }
            .padding(.vertical, 6)
            .sensoryFeedback(.selection, trigger: tokens)
        }
    }

    private var trimmedEntry: String { entry.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Suggestions first, then anything typed that isn't one of them.
    private var chips: [String] {
        suggestions + tokens.filter { !isSuggestion($0) }
    }

    private func isSuggestion(_ value: String) -> Bool {
        suggestions.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private func contains(_ value: String) -> Bool {
        tokens.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private func toggle(_ value: String) {
        if contains(value) {
            tokens.removeAll { $0.caseInsensitiveCompare(value) == .orderedSame }
        } else {
            tokens.append(value)
        }
    }

    private func add() {
        let value = trimmedEntry
        guard !value.isEmpty else { return }
        withAnimation(Theme.snappy) {
            if !contains(value) {
                tokens.append(suggestions.first { $0.caseInsensitiveCompare(value) == .orderedSame } ?? value)
            }
            entry = ""
        }
        focused = true
    }
}

// MARK: - Form pieces

/// A form row holding a custom control edge to edge.
extension View {
    func onboardingControlRow() -> some View {
        listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
    }
}
