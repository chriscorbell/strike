import SwiftUI

/// Lose, maintain or gain; the weekly rate; an optional target weight.
struct OnboardingGoalStep: View {
    @Bindable var model: OnboardingModel

    private var units: UnitSystem { model.units }
    private var goal: Profile.Goal { model.draft.profile.goal }

    var body: some View {
        Section {
            OnboardingTiles(
                options: GoalType.allCases.map { type in
                    .init(value: type, title: type.displayName, systemImage: Self.symbol(type))
                },
                selection: goalBinding
            )
            .onboardingControlRow()
        }

        if goal.type != .maintain {
            Section {
                OnboardingTiles(options: rateOptions, selection: $model.draft.profile.goal.ratePercentPerWeek)
                    .onboardingControlRow()
            } header: {
                Text("Weekly rate")
            } footer: {
                Text(rateFooter)
            }
        }

        Section {
            OnboardingNumberField(
                title: "Target weight",
                value: OnboardingBind.converted(
                    $model.draft.profile.goal.targetWeightKg,
                    toDisplay: units.weight(fromKg:),
                    fromDisplay: units.kg(fromWeight:)
                ),
                unit: units.weightSymbol,
                decimals: 1,
                placeholder: "Optional"
            )
        }
    }

    private static func symbol(_ type: GoalType) -> String {
        switch type {
        case .lose: "arrow.down.right"
        case .maintain: "equal"
        case .gain: "arrow.up.right"
        }
    }

    private var goalBinding: Binding<GoalType> {
        Binding {
            model.draft.profile.goal.type
        } set: { type in
            withAnimation(Theme.spring) { model.draft.setGoal(type) }
        }
    }

    private var rateOptions: [OnboardingTiles<Double>.Option] {
        let weight = model.referenceWeightKg
        return model.draft.rateOptions.map { rate in
            let change = weight.map { model.draft.weeklyChange(rate: rate, weightKg: $0) }
            return .init(
                value: rate,
                title: OnboardingDraft.rateText(rate),
                subtitle: change,
                accessibilityLabel: [OnboardingDraft.rateText(rate), change.map { "about \($0) a week" }].compactMap(\.self).joined(separator: ", ")
            )
        }
    }

    private var rateFooter: String {
        let verb = goal.type == .lose ? "lose" : "gain"
        if let weight = model.referenceWeightKg {
            return "Share of body weight to \(verb) each week, shown at \(units.formatWeight(kg: weight, decimals: 0))."
        }
        return "Share of body weight to \(verb) each week."
    }
}

/// Activity outside lifting, sleep window and the weekly check-in day.
struct OnboardingDayStep: View {
    @Bindable var model: OnboardingModel

    var body: some View {
        Section {
            Picker("Activity", selection: $model.draft.profile.activityLevel) {
                ForEach(ActivityLevel.allCases) { level in
                    OnboardingDetailOption(title: level.displayName, detail: level.detail)
                        .tag(level)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
            .sensoryFeedback(.selection, trigger: model.draft.profile.activityLevel)
        } header: {
            Text("Activity outside lifting")
        }

        Section {
            DatePicker(
                "Wake up",
                selection: OnboardingBind.time($model.draft.profile.schedule.wakeTime),
                displayedComponents: .hourAndMinute
            )
            DatePicker(
                "Bedtime",
                selection: OnboardingBind.time($model.draft.profile.schedule.sleepTime),
                displayedComponents: .hourAndMinute
            )
        } header: {
            Text("Sleep")
        } footer: {
            Text("Meals are timed between these.")
        }

        Section {
            Picker("Check-in day", selection: $model.draft.profile.schedule.checkInDay) {
                ForEach(Dates.orderedWeekdays, id: \.self) { day in
                    Text(Dates.weekdays[day]).tag(day)
                }
            }
        } footer: {
            Text("A weekly look at your weight trend, training and eating. Plan weeks start on this day.")
        }
    }
}

/// A two-line option for inline pickers: name and a short explanation.
struct OnboardingDetailOption: View {
    var title: String
    var detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
