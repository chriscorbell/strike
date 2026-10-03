import SwiftUI

/// Weight trend, links to weigh-ins, measurements and exercises, and recent sessions.
struct BodyProgressView: View {
    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Progress")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        SettingsToolbarButton()
                    }
                }
                .task { await progress.load() }
                .onChange(of: app.coachJobsTick) {
                    Task { await progress.loadMeso() }
                }
                .onChange(of: progress.range) {
                    Task { await progress.loadWeights() }
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let weights = progress.weights {
            dashboard(weights)
        } else if let error = progress.weightsError {
            LoadErrorView(message: error) { await progress.load() }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func dashboard(_ weights: WeightsResponse) -> some View {
        @Bindable var progress = progress
        return ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                BodyWeightCard(
                    weights: weights,
                    units: app.units,
                    goal: app.profile?.goal.type,
                    range: $progress.range
                )

                VStack(spacing: 0) {
                    BodyNavRow(title: "Weigh-ins", systemImage: "scalemass", value: latestWeighIn(weights)) {
                        BodyWeighInsView()
                    }
                    Divider().padding(.leading, 40)
                    BodyNavRow(title: "Measurements", systemImage: "ruler", value: latestMeasurement) {
                        BodyMeasurementsView()
                    }
                    Divider().padding(.leading, 40)
                    BodyNavRow(title: "Exercises", systemImage: "dumbbell", value: blockSummary) {
                        ProgressExercisesView()
                    }
                }
                .padding(.horizontal, Theme.padding)
                .card(padding: 0)

                recentSessions
            }
            .padding(.horizontal, Theme.padding)
            .padding(.bottom, 24)
        }
        .background(Theme.screenBackground)
        .refreshable { await progress.load() }
    }

    // MARK: Sessions

    @ViewBuilder
    private var recentSessions: some View {
        if let sessions = progress.sessions {
            SectionTitle("Recent sessions") {
                if sessions.count > 4 {
                    NavigationLink("See all") {
                        ProgressSessionsView()
                    }
                    .font(.subheadline.weight(.medium))
                }
            }
            if sessions.isEmpty {
                Text("Finished workouts show up here.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .card()
            } else {
                sessionList(sessions)
            }
        }
    }

    private func sessionList(_ sessions: [SessionSummary]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(sessions.prefix(4).enumerated()), id: \.element.id) { index, session in
                if index > 0 {
                    Divider()
                }
                NavigationLink {
                    SessionDetailView(sessionId: session.id)
                } label: {
                    HStack(spacing: 12) {
                        ProgressSessionRow(session: session, loadUnit: app.loadUnit)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, 12)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Theme.padding)
        .card(padding: 0)
    }

    // MARK: Summaries

    private func latestWeighIn(_ weights: WeightsResponse) -> String? {
        guard let point = weights.points.last(where: { $0.weightKg != nil }) else { return nil }
        return "\(app.units.formatWeight(kg: point.weightKg)) · \(Dates.relative(point.date))"
    }

    private var latestMeasurement: String? {
        guard let latest = progress.measurements?.first else { return nil }
        if let waist = latest.waistCm {
            return "Waist \(app.units.formatLength(cm: waist))"
        }
        if let fat = latest.bodyFatPercent {
            return "\(Fmt.number(fat))% body fat"
        }
        return Dates.relative(latest.date)
    }

    private var blockSummary: String? {
        guard let meso = progress.meso else { return nil }
        let count = Set(meso.days.flatMap { $0.exercises.map(\.exerciseId) }).count
        return count == 1 ? "1 this block" : "\(count) this block"
    }
}

// MARK: - Weight card

private struct BodyWeightCard: View {
    var weights: WeightsResponse
    var units: UnitSystem
    var goal: GoalType?
    @Binding var range: ProgressStore.WeightRange

    @State private var selection: Date?
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize: CGFloat = 46

    private var samples: [BodyWeightSample] { BodyWeightSample.samples(from: weights.points, units: units) }

    var body: some View {
        let samples = samples
        let selected = BodyWeightSample.nearest(to: selection, in: samples)

        VStack(alignment: .leading, spacing: 16) {
            if samples.isEmpty {
                empty
            } else {
                header(samples: samples, selected: selected)
                BodyWeightChart(samples: samples, units: units, selection: $selection)
                    .frame(height: 210)
            }

            Picker("Range", selection: $range) {
                ForEach(ProgressStore.WeightRange.allCases) { range in
                    Text(range.label)
                        .accessibilityLabel(range.accessibilityName)
                        .tag(range)
                }
            }
            .pickerStyle(.segmented)
        }
        .card()
        .onChange(of: range) { selection = nil }
    }

    private func header(samples: [BodyWeightSample], selected: BodyWeightSample?) -> some View {
        let value = selected?.trend ?? weights.latestTrendKg.map(units.weight(fromKg:)) ?? samples.last?.trend ?? 0

        return VStack(alignment: .leading, spacing: 4) {
            Text(selected.map { Dates.medium($0.day) } ?? "Trend weight")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
                .contentTransition(.opacity)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(Fmt.number(value, decimals: 1))
                    .font(.number(size: numberSize, weight: .bold))
                    .contentTransition(.numericText(value: value))
                Text(units.weightSymbol)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            Group {
                if let selected {
                    Text(selected.weight.map { "Scale \(Fmt.number($0)) \(units.weightSymbol)" } ?? "No weigh-in")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                } else {
                    rateRow
                }
            }
            .frame(minHeight: 26, alignment: .leading)
        }
        .animation(Theme.snappy, value: selected?.day)
    }

    @ViewBuilder
    private var rateRow: some View {
        if let rate = weights.rateKgPerWeek {
            let pace = BodyPace(rate: rate, target: weights.targetRateKgPerWeek, goal: goal)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    rateText(rate)
                    Spacer(minLength: 4)
                    if let pace { paceTag(pace) }
                }
                VStack(alignment: .leading, spacing: 6) {
                    rateText(rate)
                    if let pace { paceTag(pace) }
                }
            }
        } else {
            Text("Rate shows after a week of weigh-ins")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func rateText(_ rate: Double) -> some View {
        HStack(spacing: 6) {
            Text(units.formatRate(kgPerWeek: rate))
                .font(.subheadline.weight(.semibold))
            Text("goal \(units.formatRate(kgPerWeek: weights.targetRateKgPerWeek))")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .monospacedDigit()
        .lineLimit(1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rate \(units.formatRate(kgPerWeek: rate)), goal \(units.formatRate(kgPerWeek: weights.targetRateKgPerWeek))")
    }

    private func paceTag(_ pace: BodyPace) -> some View {
        Tag(text: pace.label, systemImage: pace.symbol, tint: pace.tint)
            .fixedSize()
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("No weigh-ins yet")
                .font(.headline)
            Text("Log your weight to start a trend.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            NavigationLink {
                BodyWeighInsView(startsAdding: true)
            } label: {
                Label("Log weight", systemImage: "plus")
            }
            .buttonStyle(.glass)
        }
        .padding(.vertical, 8)
    }
}

/// How the weekly rate compares with the goal's rate, in the goal's direction.
private enum BodyPace {
    case onTrack, ahead, behind, driftingUp, driftingDown

    init?(rate: Double?, target: Double, goal: GoalType?) {
        guard let rate else { return nil }
        if goal == .maintain || abs(target) < 0.05 {
            if abs(rate) <= 0.15 {
                self = .onTrack
            } else {
                self = rate > 0 ? .driftingUp : .driftingDown
            }
            return
        }
        let tolerance = max(0.1, abs(target) * 0.25)
        let diff = rate - target
        if abs(diff) <= tolerance {
            self = .onTrack
        } else {
            // Faster than planned in the goal's direction.
            let faster = target < 0 ? diff < 0 : diff > 0
            self = faster ? .ahead : .behind
        }
    }

    var label: String {
        switch self {
        case .onTrack: "On track"
        case .ahead: "Ahead of pace"
        case .behind: "Behind pace"
        case .driftingUp: "Drifting up"
        case .driftingDown: "Drifting down"
        }
    }

    var symbol: String {
        switch self {
        case .onTrack: "checkmark.circle.fill"
        case .ahead: "hare.fill"
        case .behind: "tortoise.fill"
        case .driftingUp: "arrow.up.right"
        case .driftingDown: "arrow.down.right"
        }
    }

    var tint: Color { self == .onTrack ? Theme.success : Theme.warning }
}

// MARK: - Rows

/// A navigation row inside a dashboard card.
private struct BodyNavRow<Destination: View>: View {
    var title: String
    var systemImage: String
    var value: String?
    @ViewBuilder var destination: () -> Destination

    var body: some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.tint)
                    .frame(width: 28)
                    .accessibilityHidden(true)
                Text(title)
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                if let value {
                    Text(value)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 13)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }
}

/// A finished or skipped session: label, date and location, and its set count.
struct ProgressSessionRow: View {
    var session: SessionSummary
    var loadUnit: LoadUnit

    private var dateText: String {
        if let date = session.date { return Dates.relative(date) }
        if let done = Dates.timestamp(session.completedAt) { return Dates.relative(Dates.localDate(from: done)) }
        return "Week \(session.week + 1)"
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(session.label)
                    .font(.body.weight(.medium))
                    .foregroundStyle(session.status == .skipped ? .secondary : .primary)
                Text("\(dateText) · \(session.location.displayName)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if session.status == .skipped {
                Tag(text: "Skipped")
            } else {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(session.setCount == 1 ? "1 set" : "\(session.setCount) sets")
                        .font(.subheadline.weight(.medium))
                    if session.volume > 0 {
                        Text("\(Fmt.integer(session.volume)) \(loadUnit.symbol)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .monospacedDigit()
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Every recent session, newest first.
struct ProgressSessionsView: View {
    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress

    var body: some View {
        Group {
            if let sessions = progress.sessions, !sessions.isEmpty {
                List(sessions) { session in
                    NavigationLink {
                        SessionDetailView(sessionId: session.id)
                    } label: {
                        ProgressSessionRow(session: session, loadUnit: app.loadUnit)
                    }
                }
                .listStyle(.insetGrouped)
            } else if progress.sessions == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView("No sessions yet", systemImage: "figure.strengthtraining.traditional", description: Text("Finished workouts show up here."))
            }
        }
        .navigationTitle("Sessions")
        .refreshable { await progress.loadSessions() }
        .task {
            if progress.sessions == nil { await progress.loadSessions() }
        }
    }
}
