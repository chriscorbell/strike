import SwiftUI

// MARK: - Formatting

extension CheckIn {
    /// "Week of Oct 3": the plan week the check-in opened.
    var weekTitle: String { "Week of \(Dates.short(weekStart))" }

    /// "+100 kcal", "−150 kcal", or "No change".
    var adjustmentText: String {
        let kcal = adjustmentKcal.rounded()
        return kcal == 0 ? "No change" : "\(Fmt.signed(kcal, decimals: 0)) kcal"
    }

    var sessionsText: String { "\(sessionsCompleted) of \(sessionsPlanned) sessions" }

    var mealAdherenceText: String? {
        mealAdherence.map { $0.formatted(.percent.precision(.fractionLength(0))) }
    }
}

// MARK: - Due card

/// Shown at the top of Plan when this week's check-in is due.
struct CheckInDueCard: View {
    var run: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "checklist")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.tint)
                    .frame(width: 28)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Weekly check-in")
                        .font(.headline)
                    Text("Review last week and update your calories.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Button(action: run) {
                Text("Run check-in")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 32)
            }
            .buttonStyle(.glassProminent)
        }
        .card()
    }
}

// MARK: - List rows

/// A check-in in a list: week, calorie change, weight trend, training and meals, and the coach note.
struct CheckInRow: View {
    @Environment(AppModel.self) private var app
    var checkIn: CheckIn
    var isCoachNotePending: Bool
    /// Rows in a `List` already get vertical insets.
    var verticalPadding: CGFloat = 14

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(checkIn.weekTitle)
                        .font(.headline)
                    Spacer(minLength: 8)
                    Text(checkIn.adjustmentText)
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(checkIn.adjustmentKcal.rounded() == 0 ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                }

                VStack(alignment: .leading, spacing: 2) {
                    if let trend = checkIn.trendKg {
                        Text("\(app.units.formatWeight(kg: trend)) · \(rateText)")
                    }
                    Text([checkIn.sessionsText, checkIn.mealAdherenceText.map { "\($0) of meals" }].compactMap(\.self).joined(separator: " · "))
                }
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)

                if let note = checkIn.coachNote {
                    Text(note)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .padding(.top, 2)
                } else if isCoachNotePending {
                    CoachNotePendingLabel()
                        .padding(.top, 2)
                }
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, verticalPadding)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows the check-in")
    }

    private var rateText: String {
        "\(app.units.formatRate(kgPerWeek: checkIn.rateKgPerWeek)), target \(app.units.formatRate(kgPerWeek: checkIn.targetRateKgPerWeek))"
    }
}

/// "Coach note on the way", quiet, with a small spinner.
struct CoachNotePendingLabel: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .controlSize(.mini)
            Text("Coach note on the way")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }
}

/// The latest few check-ins in a single card.
struct CheckInsCard: View {
    @Environment(PlanStore.self) private var store
    var limit: Int

    var body: some View {
        let shown = Array(store.checkIns.prefix(limit))
        VStack(spacing: 0) {
            ForEach(shown) { checkIn in
                if checkIn.id != shown.first?.id {
                    Divider()
                }
                NavigationLink(value: PlanRoute.checkIn(checkIn.id)) {
                    CheckInRow(checkIn: checkIn, isCoachNotePending: store.isCoachNotePending(checkIn))
                }
                .buttonStyle(.plain)
            }
            if store.checkIns.count > limit {
                Divider()
                NavigationLink(value: PlanRoute.allCheckIns) {
                    HStack {
                        Text("All check-ins")
                        Spacer()
                        Text("\(store.checkIns.count)")
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .frame(minHeight: 48)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Theme.padding)
        .frame(maxWidth: .infinity)
        .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
    }
}

// MARK: - All check-ins

struct CheckInListView: View {
    @Environment(PlanStore.self) private var store

    var body: some View {
        List(store.checkIns) { checkIn in
            NavigationLink(value: PlanRoute.checkIn(checkIn.id)) {
                CheckInRow(checkIn: checkIn, isCoachNotePending: store.isCoachNotePending(checkIn), verticalPadding: 4)
            }
            .navigationLinkIndicatorVisibility(.hidden)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Check-ins")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.load() }
    }
}

// MARK: - Detail

struct CheckInDetailView: View {
    @Environment(PlanStore.self) private var store
    @Environment(AppModel.self) private var app
    var checkInId: Int

    var body: some View {
        if let checkIn = store.checkIns.first(where: { $0.id == checkInId }) {
            content(checkIn)
        } else {
            ContentUnavailableView("Check-in not found", systemImage: "checklist")
        }
    }

    private func content(_ checkIn: CheckIn) -> some View {
        List {
            Section("Coach") {
                if let note = checkIn.coachNote {
                    Text(note)
                        .padding(.vertical, 4)
                } else if store.isCoachNotePending(checkIn) {
                    CoachNotePendingLabel()
                } else {
                    Text("No note for this week.")
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                ValueRow(label: "Change", value: checkIn.adjustmentKcal.rounded() == 0 ? "None" : "\(checkIn.adjustmentText) a day")
            } header: {
                Text("Calories")
            } footer: {
                if !checkIn.adjustmentReason.isEmpty {
                    Text(checkIn.adjustmentReason)
                }
            }

            Section("Weight") {
                ValueRow(label: "Trend", value: app.units.formatWeight(kg: checkIn.trendKg))
                ValueRow(label: "Weekly rate", value: app.units.formatRate(kgPerWeek: checkIn.rateKgPerWeek))
                ValueRow(label: "Target rate", value: app.units.formatRate(kgPerWeek: checkIn.targetRateKgPerWeek))
                ValueRow(label: "Weigh-ins", value: "\(checkIn.weighIns)")
            }

            Section("Last week") {
                ValueRow(label: "Sessions", value: "\(checkIn.sessionsCompleted) of \(checkIn.sessionsPlanned)")
                ValueRow(label: "Meals on plan", value: checkIn.mealAdherenceText ?? "—")
            }

            if let note = checkIn.userNote, !note.isEmpty {
                Section("Your note") {
                    Text(note)
                        .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(checkIn.weekTitle)
        .navigationBarTitleDisplayMode(.inline)
        .navigationSubtitle(checkedInText(checkIn))
        .refreshable { await store.load() }
        .animation(Theme.spring, value: checkIn.coachNote)
    }

    private func checkedInText(_ checkIn: CheckIn) -> String {
        guard let date = Dates.timestamp(checkIn.createdAt) else { return "" }
        return "Checked in \(date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))"
    }
}
