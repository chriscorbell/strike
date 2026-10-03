import SwiftUI

/// A compact summary of every answer, with a jump back to each screen.
struct OnboardingReviewStep: View {
    @Bindable var model: OnboardingModel

    private var draft: OnboardingDraft { model.draft }
    private var p: Profile { model.draft.profile }
    private var units: UnitSystem { model.units }

    var body: some View {
        ForEach(model.steps.filter { $0 != .review }) { step in
            Section {
                rows(for: step)
            } header: {
                HStack(alignment: .firstTextBaseline) {
                    Text(step.title)
                    Spacer()
                    Button("Edit") { model.revisit(step) }
                        .font(.subheadline.weight(.semibold))
                        .textCase(nil)
                        .accessibilityLabel("Edit \(step.title)")
                }
            }
        }
    }

    @ViewBuilder
    private func rows(for step: OnboardingStep) -> some View {
        if let issue = model.issue(for: step) {
            Label(issue, systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline)
                .foregroundStyle(Theme.warning)
        }
        switch step {
        case .about:
            row("Name", p.name.trimmingCharacters(in: .whitespacesAndNewlines))
            row("Sex", p.sex.displayName)
            row("Born", Dates.date(from: p.birthDate)?.formatted(.dateTime.month(.wide).day().year()) ?? p.birthDate)
            row("Height", units.formatHeight(cm: p.heightCm))
            if let weight = draft.weightKg {
                row("Weight", units.formatWeight(kg: weight))
            }
            row("Units", p.units == .imperial ? "Imperial" : "Metric")
        case .body:
            bodyRows
        case .goal:
            row("Goal", p.goal.type.displayName)
            if p.goal.type != .maintain {
                let rate = OnboardingDraft.rateText(p.goal.ratePercentPerWeek)
                let change = model.referenceWeightKg.map { draft.weeklyChange(rate: p.goal.ratePercentPerWeek, weightKg: $0) }
                row("Rate", change.map { "\(rate) · \($0) a week" } ?? "\(rate) a week")
            }
            row("Target", p.goal.targetWeightKg.map { units.formatWeight(kg: $0) } ?? "None")
        case .day:
            row("Activity", p.activityLevel.displayName)
            row("Wake up", Dates.display(p.schedule.wakeTime))
            row("Bedtime", Dates.display(p.schedule.sleepTime))
            row("Week starts", Dates.weekdays[p.schedule.checkInDay])
            row("Grocery day", Dates.weekdays[p.schedule.effectiveShoppingDay])
        case .training:
            row("Experience", p.training.experience.displayName)
            row("Days", OnboardingDraft.weekdayList(p.training.days))
            row("Sessions", "\(Fmt.minutes(Double(p.training.sessionMinutes))) at \(Dates.display(p.training.workoutTime))")
            row("Usually at", p.training.defaultLocation.displayName)
            row("Focus", p.training.focusMuscles.isEmpty ? "None" : p.training.focusMuscles.map(\.displayName).joined(separator: ", "))
            if !p.training.limitations.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                row("Limitations", p.training.limitations)
            }
        case .equipment:
            ForEach(Location.allCases) { location in
                let equipment = p.equipment[location]
                row(location.displayName, equipment.available ? equipmentSummary(equipment) : "Not available")
            }
        case .food:
            row("Meals", "\(p.nutrition.mealsPerDay) a day")
            row("Diet", p.nutrition.dietStyle.displayName)
            row("Cooking", p.nutrition.cookingTime.detail)
            row("Budget", "\(Fmt.usdWhole(p.nutrition.weeklyBudgetUsd)) a week")
            row("Allergies", list(p.nutrition.allergies))
            if !p.nutrition.avoidFoods.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                row("Avoid", p.nutrition.avoidFoods)
            }
            if !p.nutrition.favoriteFoods.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                row("Favorites", p.nutrition.favoriteFoods)
            }
            row("Grab-and-go", list(p.nutrition.grabAndGo))
            row("Kitchen", p.nutrition.kitchen.isEmpty ? "None" : p.nutrition.kitchen.map(\.displayName).joined(separator: ", "))
        case .review:
            EmptyView()
        }
    }

    @ViewBuilder
    private var bodyRows: some View {
        let m = draft.measurements
        if m.isEmpty {
            row("Measurements", "Skipped")
        } else {
            if let cm = m.waistCm { row("Waist", units.formatLength(cm: cm)) }
            if let cm = m.neckCm { row("Neck", units.formatLength(cm: cm)) }
            if let cm = m.hipsCm { row("Hips", units.formatLength(cm: cm)) }
            if let cm = m.chestCm { row("Chest", units.formatLength(cm: cm)) }
            if let cm = m.armCm { row("Upper arm", units.formatLength(cm: cm)) }
            if let cm = m.thighCm { row("Thigh", units.formatLength(cm: cm)) }
            if let bodyFat = m.bodyFatPercent {
                row("Body fat", "\(Fmt.number(bodyFat, decimals: 1))%")
            } else if m.waistCm != nil, m.neckCm != nil {
                row("Body fat", "Estimated")
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        LabeledContent(label) {
            Text(value.isEmpty ? "—" : value)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
        }
    }

    private func list(_ values: [String]) -> String {
        let cleaned = OnboardingDraft.cleaned(values)
        return cleaned.isEmpty ? "None" : cleaned.joined(separator: ", ")
    }

    private func equipmentSummary(_ equipment: LocationEquipment) -> String {
        let items = equipment.items.count
        let itemText = items == 0 ? "nothing else" : items == 1 ? "1 other item" : "\(items) other items"
        return "\(draft.dumbbellSummary(equipment.dumbbells)), \(itemText)"
    }
}
