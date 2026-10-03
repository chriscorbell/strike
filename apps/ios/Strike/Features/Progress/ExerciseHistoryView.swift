import Charts
import SwiftUI

/// History for one exercise: estimated 1RM (or top weight, or reps for bodyweight work) over time,
/// then every session with its sets.
struct ExerciseHistoryView: View {
    let exerciseId: String
    var name: String

    @Environment(AppModel.self) private var app
    @Environment(ProgressStore.self) private var progress
    @State private var history: ExerciseHistoryResponse?
    @State private var loadError: String?
    @State private var metric: Metric = .e1rm

    enum Metric: String, CaseIterable, Identifiable {
        case e1rm, weight, reps

        var id: Self { self }

        var label: String {
            switch self {
            case .e1rm: "Est. 1RM"
            case .weight: "Top weight"
            case .reps: "Best reps"
            }
        }

        func value(_ point: ExerciseHistoryResponse.Point) -> Double? {
            switch self {
            case .e1rm: point.e1rm
            case .weight: point.bestWeight
            case .reps: point.bestReps
            }
        }
    }

    var body: some View {
        Group {
            if let history {
                if history.points.isEmpty {
                    ContentUnavailableView("No history yet", systemImage: "chart.xyaxis.line", description: Text("Log this exercise in a workout to see it here."))
                } else {
                    content(history)
                }
            } else if let loadError {
                LoadErrorView(message: loadError) { await load() }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        do {
            let response = try await progress.exerciseHistory(exerciseId)
            let metrics = Self.metrics(for: response)
            if !metrics.contains(metric), let first = metrics.first { metric = first }
            withAnimation(Theme.spring) { history = response }
            loadError = nil
        } catch is CancellationError {
        } catch {
            if history == nil {
                loadError = error.localizedDescription
            } else {
                app.report(error)
            }
        }
    }

    /// The measures this exercise's history can chart; bodyweight work only has reps.
    private static func metrics(for history: ExerciseHistoryResponse) -> [Metric] {
        var metrics: [Metric] = []
        if history.points.contains(where: { $0.e1rm != nil }) { metrics.append(.e1rm) }
        if history.points.contains(where: { $0.bestWeight != nil }) { metrics.append(.weight) }
        return metrics.isEmpty ? [.reps] : metrics
    }

    private var loadUnit: LoadUnit { app.loadUnit }

    private func unitCaption(_ exercise: ExerciseInfo) -> String {
        if metric == .reps { return "reps" }
        return exercise.loadType == .dumbbell ? "\(loadUnit.symbol) per hand" : loadUnit.symbol
    }

    // MARK: Content

    private func content(_ history: ExerciseHistoryResponse) -> some View {
        let metrics = Self.metrics(for: history)
        let series: [(date: Date, value: Double)] = history.points.compactMap { point in
            guard let date = Dates.date(from: point.date), let value = metric.value(point) else { return nil }
            return (date, value)
        }

        return List {
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    if metrics.count > 1 {
                        Picker("Measure", selection: $metric) {
                            ForEach(metrics) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                    summary(series.map(\.value), caption: unitCaption(history.exercise))
                    if !series.isEmpty {
                        chart(series, unit: unitCaption(history.exercise))
                            .frame(height: 190)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("Sessions") {
                ForEach(history.points.reversed(), id: \.sessionId) { point in
                    NavigationLink {
                        SessionDetailView(sessionId: point.sessionId)
                    } label: {
                        sessionRow(point)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
        .animation(Theme.spring, value: metric)
    }

    private func summary(_ values: [Double], caption: String) -> some View {
        let latest = values.last
        let best = values.max()
        let change = values.count > 1 ? (values.last ?? 0) - (values.first ?? 0) : nil

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                stat("Latest", latest.map { Fmt.number($0) } ?? "—", value: latest ?? 0)
                stat("Best", best.map { Fmt.number($0) } ?? "—", value: best ?? 0)
                stat("Change", change.map { Fmt.signed($0) } ?? "—", value: change ?? 0)
            }
            Text(metric == .e1rm ? "Estimated one-rep max, \(caption)" : caption)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func stat(_ label: String, _ text: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(text)
                .font(.number(.title2, weight: .bold))
                .contentTransition(.numericText(value: value))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func chart(_ series: [(date: Date, value: Double)], unit: String) -> some View {
        let values = series.map(\.value)
        let lo = values.min() ?? 0
        let hi = values.max() ?? 1
        let pad = max((hi - lo) * 0.2, metric == .reps ? 1 : (loadUnit == .lb ? 5 : 2.5))

        return Chart {
            ForEach(Array(series.enumerated()), id: \.offset) { _, point in
                LineMark(x: .value("Date", point.date, unit: .day), y: .value(metric.label, point.value))
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                    .foregroundStyle(Color.accentColor)
                PointMark(x: .value("Date", point.date, unit: .day), y: .value(metric.label, point.value))
                    .symbolSize(40)
                    .foregroundStyle(Color.accentColor)
            }
        }
        .chartYScale(domain: max(0, lo - pad) ... hi + pad)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                AxisValueLabel()
            }
        }
        .accessibilityChartDescriptor(ProgressChartDescriptor(title: name, seriesName: metric.label, unit: unit, points: series))
    }

    private func sessionRow(_ point: ExerciseHistoryResponse.Point) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(Dates.medium(point.date))
                    .font(.body.weight(.medium))
                Spacer(minLength: 8)
                if let e1rm = point.e1rm {
                    Text("1RM \(Fmt.number(e1rm))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            Text(point.sets.map { ProgressFormat.set(weight: $0.weight, reps: Int($0.reps.rounded()), rir: $0.rir.map { Int($0.rounded()) }) }.joined(separator: "  ·  "))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .monospacedDigit()
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
