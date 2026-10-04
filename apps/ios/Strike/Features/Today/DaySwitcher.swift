import SwiftUI

/// Previous day, the date (tap for a calendar), next day.
struct DaySwitcher: View {
    var date: LocalDate
    var onStep: (Int) -> Void
    var onPick: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button {
                onStep(-1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel("Previous day")

            Button(action: onPick) {
                Label(Dates.relative(date), systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                    .contentTransition(.numericText())
                    .frame(maxWidth: .infinity, minHeight: 36)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Choose a day, showing \(Dates.long(date))")

            Button {
                onStep(1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel("Next day")
        }
        .sensoryFeedback(.selection, trigger: date)
        .animation(Theme.spring, value: date)
    }
}

/// A calendar to jump to any day.
struct DayPickerSheet: View {
    var selected: LocalDate
    var onChoose: (LocalDate) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var day = Date.now

    var body: some View {
        NavigationStack {
            DatePicker("Day", selection: $day, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .padding(.horizontal)
                .navigationTitle("Go to day")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .principal) {
                        Button("Today") { onChoose(Dates.today) }
                            .font(.subheadline.weight(.semibold))
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Go") { onChoose(Dates.localDate(from: day)) }
                    }
                }
                .onAppear { day = Dates.date(from: selected) ?? .now }
        }
        .presentationDetents([.medium, .large])
    }
}
