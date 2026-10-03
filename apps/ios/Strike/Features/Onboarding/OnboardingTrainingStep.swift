import SwiftUI

/// Experience, weekdays, session length and time, usual location, focus muscles and limitations.
struct OnboardingTrainingStep: View {
    @Bindable var model: OnboardingModel

    private var training: Profile.Training { model.draft.profile.training }

    var body: some View {
        Section {
            Picker("Experience", selection: $model.draft.profile.training.experience) {
                ForEach(Experience.allCases) { level in
                    OnboardingDetailOption(title: level.displayName, detail: level.detail)
                        .tag(level)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
            .sensoryFeedback(.selection, trigger: training.experience)
        } header: {
            Text("Experience")
        }

        Section {
            OnboardingWeekdayPicker(days: $model.draft.profile.training.days, maxCount: OnboardingDraft.trainingDaysRange.upperBound)
                .onboardingControlRow()
        } header: {
            Text("Training days")
        } footer: {
            Text(daysFooter)
                .contentTransition(.numericText())
        }

        Section {
            Stepper(
                value: $model.draft.profile.training.sessionMinutes,
                in: OnboardingDraft.sessionMinutesRange,
                step: 5
            ) {
                LabeledContent("Session length") {
                    Text(Fmt.minutes(Double(training.sessionMinutes)))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(training.sessionMinutes)))
                }
            }
            .sensoryFeedback(.selection, trigger: training.sessionMinutes)
            DatePicker(
                "Usual start time",
                selection: OnboardingBind.time($model.draft.profile.training.workoutTime),
                displayedComponents: .hourAndMinute
            )
            Picker("Usually at", selection: $model.draft.profile.training.defaultLocation) {
                ForEach(Location.allCases) { location in
                    Label(location.displayName, systemImage: location.symbol).tag(location)
                }
            }
        }

        Section {
            OnboardingChipPicker(
                items: Muscle.allCases,
                selection: $model.draft.profile.training.focusMuscles,
                limit: OnboardingDraft.focusLimit
            ) { $0.displayName }
            .onboardingControlRow()
        } header: {
            Text("Focus muscles")
        } footer: {
            Text("Optional. Up to 4 get extra volume.")
        }

        Section {
            TextField("Injuries or movements to avoid", text: $model.draft.profile.training.limitations, axis: .vertical)
                .lineLimit(2 ... 6)
        } header: {
            Text("Limitations")
        }
    }

    private var daysFooter: String {
        let count = Set(training.days).count
        if !OnboardingDraft.trainingDaysRange.contains(count) { return "Pick 2 to 6 days." }
        return "\(count) days a week"
    }
}
