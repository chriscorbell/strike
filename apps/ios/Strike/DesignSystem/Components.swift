import SwiftUI

// MARK: - Macro progress

/// A circular progress ring that animates its fill.
struct ProgressRing: View {
    var progress: Double
    var color: Color
    var lineWidth: CGFloat = 10

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if progress > 1 {
                // Past target: a second lap in a stronger tone.
                Circle()
                    .trim(from: 0, to: min(progress - 1, 1))
                    .stroke(color.mix(with: .white, by: 0.35), style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
        }
        .animation(Theme.spring, value: progress)
    }
}

/// A labelled horizontal bar: "Protein 92 / 180g".
struct MacroBar: View {
    var label: String
    var value: Double
    var target: Double
    var color: Color
    var unit: String = "g"

    private var progress: Double { target > 0 ? value / target : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.subheadline.weight(.medium))
                Spacer(minLength: 8)
                HStack(spacing: 0) {
                    Text(Fmt.integer(value))
                        .font(.subheadline.weight(.semibold))
                        .contentTransition(.numericText(value: value))
                    Text(" / \(Fmt.integer(target))\(unit)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .monospacedDigit()
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.18))
                    Capsule().fill(color)
                        .frame(width: max(6, geo.size.width * min(progress, 1)))
                        .opacity(value > 0 ? 1 : 0)
                }
            }
            .frame(height: 6)
        }
        .animation(Theme.spring, value: value)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(Fmt.integer(value)) of \(Fmt.integer(target)) \(unit == "g" ? "grams" : unit)")
    }
}

/// "540 kcal · 45P · 60C · 12F" in a compact, colored line.
struct MacroLine: View {
    var macros: Macros
    var showKcal = true
    var font: Font = .footnote

    var body: some View {
        HStack(spacing: 8) {
            if showKcal {
                Text(Fmt.kcal(macros.kcal))
                    .foregroundStyle(.primary)
            }
            macro(macros.proteinG, "P", Theme.protein)
            macro(macros.carbsG, "C", Theme.carbs)
            macro(macros.fatG, "F", Theme.fat)
        }
        .font(font)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(Fmt.integer(macros.kcal)) calories, \(Fmt.integer(macros.proteinG)) grams protein, \(Fmt.integer(macros.carbsG)) grams carbs, \(Fmt.integer(macros.fatG)) grams fat")
    }

    private func macro(_ value: Double, _ letter: String, _ color: Color) -> some View {
        HStack(spacing: 2) {
            Text(Fmt.integer(value))
                .foregroundStyle(.primary)
            Text(letter)
                .foregroundStyle(color)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Small pieces

/// A small capsule label for statuses and roles.
struct Tag: View {
    var text: String
    var systemImage: String? = nil
    var tint: Color = .secondary

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage)
                    .imageScale(.small)
            }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.14), in: .capsule)
    }
}

/// Section title used above cards on scrolling screens.
struct SectionTitle: View {
    var title: String
    var trailing: AnyView? = nil

    init(_ title: String) {
        self.title = title
    }

    init(_ title: String, @ViewBuilder trailing: () -> some View) {
        self.title = title
        self.trailing = AnyView(trailing())
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
            Spacer()
            trailing
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
    }
}

/// A horizontal row of equally sized choices, used for RIR, soreness, pump and workload.
struct ChoiceChips<Value: Hashable>: View {
    var options: [(value: Value, label: String)]
    @Binding var selection: Value?
    var tint: Color = .accentColor
    var height: CGFloat = 44

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { option in
                let selected = selection == option.value
                Button {
                    withAnimation(Theme.snappy) {
                        selection = selected ? nil : option.value
                    }
                } label: {
                    Text(option.label)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, minHeight: height)
                        .foregroundStyle(selected ? Color.white : Color.primary)
                        .background(
                            selected ? AnyShapeStyle(tint) : AnyShapeStyle(Color(.tertiarySystemFill)),
                            in: .rect(cornerRadius: 12, style: .continuous)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityElement(children: .contain)
    }
}

/// A big − value + control for use with sweaty hands.
struct BigStepper: View {
    var value: String
    var unit: String
    var accessibilityName: String
    var canDecrement = true
    var canIncrement = true
    var onDecrement: () -> Void
    var onIncrement: () -> Void
    var onTapValue: (() -> Void)? = nil

    @ScaledMetric(relativeTo: .title) private var numberSize: CGFloat = 28
    @ScaledMetric(relativeTo: .title) private var buttonWidth: CGFloat = 46

    var body: some View {
        HStack(spacing: 0) {
            stepButton("minus", enabled: canDecrement, action: onDecrement)
                .accessibilityLabel("Decrease \(accessibilityName)")
            Button {
                onTapValue?()
            } label: {
                VStack(spacing: 0) {
                    Text(value)
                        .font(.number(size: numberSize, weight: .semibold))
                        .contentTransition(.numericText())
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(unit)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .disabled(onTapValue == nil)
            .accessibilityLabel(accessibilityName)
            .accessibilityValue("\(value) \(unit)")
            stepButton("plus", enabled: canIncrement, action: onIncrement)
                .accessibilityLabel("Increase \(accessibilityName)")
        }
        .frame(minHeight: Theme.bigTap + 8)
        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 18, style: .continuous))
    }

    private func stepButton(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(Theme.snappy) { action() }
        } label: {
            Image(systemName: symbol)
                .font(.title3.weight(.bold))
                .frame(width: buttonWidth, height: Theme.bigTap + 8)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? Color.accentColor : Color.secondary.opacity(0.4))
        .disabled(!enabled)
        .buttonRepeatBehavior(.enabled)
    }
}

/// Shows that the coach is working on background jobs.
struct CoachWorkingBanner: View {
    var jobs: [Job]

    var body: some View {
        if let first = jobs.first {
            HStack(spacing: 12) {
                ProgressView()
                    .controlSize(.small)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Coach is working")
                        .font(.subheadline.weight(.semibold))
                    Text(jobs.count > 1 ? "\(first.kind.activity) and \(jobs.count - 1) more" : first.kind.activity)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .card(padding: 14)
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
        }
    }
}

/// Inline error with a retry button, for screens whose load failed.
struct LoadErrorView: View {
    var message: String
    var retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Couldn't load", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Try again") {
                Task { await retry() }
            }
            .buttonStyle(.glass)
        }
    }
}

/// Key/value row with tabular numbers.
struct ValueRow: View {
    var label: String
    var value: String
    var systemImage: String? = nil

    var body: some View {
        HStack {
            if let systemImage {
                Label(label, systemImage: systemImage)
            } else {
                Text(label)
            }
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
    }
}
