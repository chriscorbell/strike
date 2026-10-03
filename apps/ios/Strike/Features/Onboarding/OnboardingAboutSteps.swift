import SwiftUI

/// Name, sex, birth date, units, height and (first run only) current weight.
struct OnboardingAboutStep: View {
    @Bindable var model: OnboardingModel

    private var units: UnitSystem { model.units }

    var body: some View {
        Section {
            TextField("Name", text: $model.draft.profile.name)
                .textContentType(.givenName)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.done)
            Picker("Sex", selection: $model.draft.profile.sex) {
                ForEach(Sex.allCases) { sex in
                    Text(sex.displayName).tag(sex)
                }
            }
            DatePicker(
                "Birth date",
                selection: OnboardingBind.day($model.draft.profile.birthDate),
                in: Self.birthDateRange,
                displayedComponents: .date
            )
        }

        Section {
            Picker("Units", selection: unitsBinding) {
                Text("Imperial (lb, in)").tag(Units.imperial)
                Text("Metric (kg, cm)").tag(Units.metric)
            }
            heightRow
            if model.mode == .initial {
                OnboardingNumberField(
                    title: "Weight",
                    value: OnboardingBind.converted(
                        $model.draft.weightKg,
                        toDisplay: units.weight(fromKg:),
                        fromDisplay: units.kg(fromWeight:)
                    ),
                    unit: units.weightSymbol,
                    decimals: 1
                )
            }
        } footer: {
            if model.mode == .initial {
                Text("Your first weigh-in. Training loads use \(units.loadUnit.symbol) too.")
            } else {
                Text("Training loads use \(units.loadUnit.symbol) too.")
            }
        }
    }

    @ViewBuilder
    private var heightRow: some View {
        if units.isImperial {
            LabeledContent("Height") {
                HStack(spacing: 4) {
                    Picker("Feet", selection: feetBinding) {
                        ForEach(4 ... 7, id: \.self) { feet in
                            Text("\(feet) ft").tag(feet)
                        }
                    }
                    Picker("Inches", selection: inchesBinding) {
                        ForEach(0 ... 11, id: \.self) { inches in
                            Text("\(inches) in").tag(inches)
                        }
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
                .fixedSize()
                .monospacedDigit()
            }
        } else {
            OnboardingNumberField(
                title: "Height",
                value: OnboardingBind.required($model.draft.profile.heightCm),
                unit: "cm",
                decimals: 0
            )
        }
    }

    private static var birthDateRange: ClosedRange<Date> {
        let earliest = Dates.date(from: "1920-01-01") ?? .distantPast
        let latest = Dates.calendar.date(byAdding: .year, value: -13, to: .now) ?? .now
        return earliest ... latest
    }

    private var unitsBinding: Binding<Units> {
        Binding {
            model.draft.profile.units
        } set: { units in
            withAnimation(Theme.spring) { model.setUnits(units) }
        }
    }

    private var totalInches: Int {
        Int((model.draft.profile.heightCm / UnitSystem.cmPerIn).rounded())
    }

    private var feetBinding: Binding<Int> {
        Binding {
            min(max(totalInches / 12, 4), 7)
        } set: { feet in
            model.draft.profile.heightCm = OnboardingDraft.heightCm(inches: feet * 12 + totalInches % 12)
        }
    }

    private var inchesBinding: Binding<Int> {
        Binding {
            totalInches % 12
        } set: { inches in
            let feet = min(max(totalInches / 12, 4), 7)
            model.draft.profile.heightCm = OnboardingDraft.heightCm(inches: feet * 12 + inches)
        }
    }
}

/// Optional tape measurements and body fat, sent with the first weigh-in.
struct OnboardingBodyStep: View {
    @Bindable var model: OnboardingModel

    private var units: UnitSystem { model.units }

    var body: some View {
        Section {
            field("Waist", \.waistCm)
            field("Neck", \.neckCm)
            field("Hips", \.hipsCm)
            field("Chest", \.chestCm)
            field("Upper arm", \.armCm)
            field("Thigh", \.thighCm)
        } header: {
            Text("Tape measurements")
        } footer: {
            Text(model.draft.profile.sex == .female
                ? "Waist, neck and hips give a body-fat estimate."
                : "Waist and neck give a body-fat estimate.")
        }

        Section {
            OnboardingNumberField(
                title: "Body fat",
                value: $model.draft.measurements.bodyFatPercent,
                unit: "%",
                decimals: 1
            )
        } footer: {
            Text("Only if you know it from a scan or calipers.")
        }
    }

    private func field(_ title: String, _ keyPath: WritableKeyPath<Measurements, Double?>) -> some View {
        let units = units
        return OnboardingNumberField(
            title: title,
            value: OnboardingBind.converted(
                $model.draft.measurements[dynamicMember: keyPath],
                toDisplay: units.length(fromCm:),
                fromDisplay: units.cm(fromLength:)
            ),
            unit: units.lengthSymbol,
            decimals: 1
        )
    }
}
