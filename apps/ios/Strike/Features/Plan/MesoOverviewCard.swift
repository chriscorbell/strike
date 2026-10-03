import SwiftUI

/// The block at a glance: name, split, start, length, where you are, and the coach's rationale.
struct MesoOverviewCard: View {
    var meso: MesoOverview
    /// Today's position in this block, when it's the active one.
    var position: TodayResponse.Meso?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(meso.name)
                        .font(.title2.weight(.bold))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    if meso.source == .fallback {
                        Tag(text: "Default plan")
                    }
                }
                if meso.split.caseInsensitiveCompare(meso.name) != .orderedSame {
                    Text(meso.split)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(alignment: .top, spacing: 12) {
                fact("Started", Dates.short(meso.startDate))
                fact("Length", meso.hardWeeks == 1 ? "1 wk + deload" : "\(meso.hardWeeks) wk + deload")
                fact("Now", now, tint: meso.status == .active)
            }

            if !meso.rationale.isEmpty {
                PlanExpandableText(text: meso.rationale)
            }
        }
        .card()
    }

    private var now: String {
        if meso.status == .completed { return "Completed" }
        guard let position, position.id == meso.id else { return "Active" }
        return position.isDeload ? "Deload" : "Week \(position.week + 1)"
    }

    private func fact(_ label: String, _ value: String, tint: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Secondary text collapsed to a few lines, with More/Less when it doesn't fit.
struct PlanExpandableText: View {
    var text: String
    var lineLimit = 3

    @State private var expanded = false
    @State private var fullHeight: CGFloat = 0
    @State private var limitedHeight: CGFloat = 0

    private var isTruncated: Bool { fullHeight > limitedHeight + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(expanded ? nil : lineLimit)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(alignment: .topLeading) {
                    // Measure the text at full length and at the line limit to know if it's cut off.
                    ZStack(alignment: .topLeading) {
                        measured(lineLimit: nil) { fullHeight = $0 }
                        measured(lineLimit: lineLimit) { limitedHeight = $0 }
                    }
                    .hidden()
                    .accessibilityHidden(true)
                }

            if isTruncated || expanded {
                Button(expanded ? "Less" : "More") {
                    withAnimation(Theme.spring) { expanded.toggle() }
                }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.plain)
                .foregroundStyle(.tint)
                .accessibilityHint(expanded ? "Collapses the rationale" : "Shows the full rationale")
            }
        }
    }

    private func measured(lineLimit: Int?, _ update: @escaping (CGFloat) -> Void) -> some View {
        Text(text)
            .font(.subheadline)
            .lineLimit(lineLimit)
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { update($0) }
    }
}

/// One training day of the block, collapsible to its header, with its exercises.
struct MesoDayCard: View {
    var index: Int
    var day: MesoOverview.Day
    var isNext: Bool
    var isExpanded: Bool
    var toggle: () -> Void

    private var setCount: Int { day.exercises.reduce(0) { $0 + $1.sets } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                header
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(headerAccessibilityLabel)
            .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
            .accessibilityHint(isExpanded ? "Hides the exercises" : "Shows the exercises")

            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(day.exercises.indices, id: \.self) { i in
                        let exercise = day.exercises[i]
                        Divider()
                        NavigationLink(value: PlanRoute.exercise(id: exercise.exerciseId, name: exercise.name)) {
                            MesoExerciseRow(exercise: exercise)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .card()
        .clipShape(.rect(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(day.label.isEmpty ? "Day \(index + 1)" : day.label)
                        .font(.headline)
                    if isNext {
                        Tag(text: "Next", tint: .accentColor)
                    }
                }
                if !day.focus.isEmpty {
                    Text(day.focus)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 6) {
                    Label(day.location.displayName, systemImage: day.location.symbol)
                        .labelStyle(PlanCompactLabelStyle())
                    Text("·")
                    Text(day.exercises.count == 1 ? "1 exercise" : "\(day.exercises.count) exercises")
                    Text("·")
                    Text(setCount == 1 ? "1 set" : "\(setCount) sets")
                }
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.down")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .rotationEffect(.degrees(isExpanded ? 180 : 0))
        }
        .contentShape(.rect)
    }

    private var headerAccessibilityLabel: String {
        var parts = [day.label.isEmpty ? "Day \(index + 1)" : day.label]
        if isNext { parts.append("next session") }
        if !day.focus.isEmpty { parts.append(day.focus) }
        parts.append(day.location.displayName)
        parts.append("\(day.exercises.count) exercises, \(setCount) sets")
        return parts.joined(separator: ", ")
    }
}

private struct MesoExerciseRow: View {
    var exercise: MesoOverview.DayExercise

    private var prescription: String {
        let reps = exercise.repMin == exercise.repMax ? "\(exercise.repMin)" : "\(exercise.repMin)–\(exercise.repMax)"
        return "\(exercise.sets) × \(reps)"
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name)
                    .font(.body)
                    .foregroundStyle(.primary)
                Text(exercise.muscle.displayName)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(prescription)
                .font(.subheadline.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 12)
        .frame(minHeight: 44)
        .contentShape(.rect)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(exercise.name), \(exercise.muscle.displayName)")
        .accessibilityValue(exercise.repMin == exercise.repMax
            ? "\(exercise.sets) sets of \(exercise.repMin) reps"
            : "\(exercise.sets) sets of \(exercise.repMin) to \(exercise.repMax) reps")
        .accessibilityHint("Shows your history")
    }
}

/// Icon and title close together, for inline metadata.
struct PlanCompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon
                .imageScale(.small)
            configuration.title
        }
    }
}
