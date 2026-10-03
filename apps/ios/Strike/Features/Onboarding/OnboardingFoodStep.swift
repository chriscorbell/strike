import SwiftUI

/// Meals per day, diet, allergies, likes and dislikes, cooking time, budget, places to grab food
/// and kitchen equipment.
struct OnboardingFoodStep: View {
    @Bindable var model: OnboardingModel

    private static let allergySuggestions = ["Peanuts", "Tree nuts", "Shellfish", "Fish", "Dairy", "Eggs", "Gluten", "Soy", "Sesame"]
    private static let placeSuggestions = ["Chipotle", "Trader Joe's", "Whole Foods", "Costco", "Sweetgreen", "Subway", "Starbucks", "7-Eleven"]

    private var nutrition: Profile.Nutrition { model.draft.profile.nutrition }

    var body: some View {
        Section {
            Stepper(value: $model.draft.profile.nutrition.mealsPerDay, in: OnboardingDraft.mealsRange) {
                LabeledContent("Meals a day") {
                    Text("\(nutrition.mealsPerDay)")
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(nutrition.mealsPerDay)))
                }
            }
            .sensoryFeedback(.selection, trigger: nutrition.mealsPerDay)
            Picker("Diet", selection: $model.draft.profile.nutrition.dietStyle) {
                ForEach(DietStyle.allCases) { style in
                    Text(style.displayName).tag(style)
                }
            }
            OnboardingNumberField(
                title: "Weekly budget",
                value: OnboardingBind.required($model.draft.profile.nutrition.weeklyBudgetUsd),
                prefix: "$",
                decimals: 0
            )
        }

        Section {
            Picker("Cooking", selection: $model.draft.profile.nutrition.cookingTime) {
                ForEach(CookingTime.allCases) { time in
                    OnboardingDetailOption(title: time.displayName, detail: time.detail)
                        .tag(time)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
            .sensoryFeedback(.selection, trigger: nutrition.cookingTime)
        } header: {
            Text("Time to cook a meal")
        }

        Section {
            OnboardingTokenEditor(
                tokens: $model.draft.profile.nutrition.allergies,
                suggestions: Self.allergySuggestions,
                placeholder: "Add an allergy"
            )
        } header: {
            Text("Allergies")
        }

        Section {
            TextField("Foods to avoid", text: $model.draft.profile.nutrition.avoidFoods, axis: .vertical)
                .lineLimit(1 ... 4)
            TextField("Favorite foods", text: $model.draft.profile.nutrition.favoriteFoods, axis: .vertical)
                .lineLimit(1 ... 4)
        } header: {
            Text("Likes and dislikes")
        }

        Section {
            OnboardingTokenEditor(
                tokens: $model.draft.profile.nutrition.grabAndGo,
                suggestions: Self.placeSuggestions,
                placeholder: "Add a place"
            )
        } header: {
            Text("Grab-and-go places")
        } footer: {
            Text("Where you'd pick up a ready-made meal.")
        }

        Section {
            OnboardingChipPicker(items: KitchenItem.allCases, selection: $model.draft.profile.nutrition.kitchen) { $0.displayName }
                .onboardingControlRow()
        } header: {
            Text("Kitchen")
        }
    }
}
