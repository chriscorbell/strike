import Charts
import SwiftUI

/// One day on the weight chart, already converted to the display unit.
struct BodyWeightSample: Identifiable, Hashable {
    var day: LocalDate
    var date: Date
    /// The scale reading, nil on days without a weigh-in.
    var weight: Double?
    var trend: Double

    var id: LocalDate { day }

    static func samples(from points: [WeightPoint], units: UnitSystem) -> [BodyWeightSample] {
        points.compactMap { point in
            guard let date = Dates.date(from: point.date) else { return nil }
            return BodyWeightSample(
                day: point.date,
                date: date,
                weight: point.weightKg.map(units.weight(fromKg:)),
                trend: units.weight(fromKg: point.trendKg)
            )
        }
    }

    /// The sample on the day nearest to `date`.
    static func nearest(to date: Date?, in samples: [BodyWeightSample]) -> BodyWeightSample? {
        guard let date else { return nil }
        return samples.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
    }
}

/// Weigh-ins as quiet dots under a smooth trend line, with scrubbing.
struct BodyWeightChart: View {
    var samples: [BodyWeightSample]
    var units: UnitSystem
    @Binding var selection: Date?

    private var selected: BodyWeightSample? { BodyWeightSample.nearest(to: selection, in: samples) }

    private var yDomain: ClosedRange<Double> {
        let values = samples.flatMap { [$0.trend] + ($0.weight.map { [$0] } ?? []) }
        guard let lo = values.min(), let hi = values.max() else { return 0 ... 1 }
        let pad = max((hi - lo) * 0.15, units.isImperial ? 1 : 0.5)
        return (lo - pad) ... (hi + pad)
    }

    var body: some View {
        Chart {
            ForEach(samples) { sample in
                if let weight = sample.weight {
                    PointMark(
                        x: .value("Date", sample.date, unit: .day),
                        y: .value("Weight", weight)
                    )
                    .symbolSize(22)
                    .foregroundStyle(Color.secondary.opacity(0.6))
                }
            }
            ForEach(samples) { sample in
                LineMark(
                    x: .value("Date", sample.date, unit: .day),
                    y: .value("Trend", sample.trend)
                )
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.accentColor)
            }
            if let selected {
                RuleMark(x: .value("Date", selected.date, unit: .day))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                PointMark(
                    x: .value("Date", selected.date, unit: .day),
                    y: .value("Trend", selected.trend)
                )
                .symbolSize(80)
                .foregroundStyle(Color.accentColor)
            }
        }
        .chartYScale(domain: yDomain)
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
        .chartXSelection(value: $selection)
        .sensoryFeedback(.selection, trigger: selected?.day)
        .accessibilityChartDescriptor(ProgressChartDescriptor(
            title: "Body weight",
            seriesName: "Trend weight",
            unit: units.weightSymbol,
            points: samples.map { ($0.date, $0.trend) }
        ))
    }
}

/// Describes a single time series to VoiceOver (and Audio Graphs).
struct ProgressChartDescriptor: AXChartDescriptorRepresentable {
    var title: String
    var seriesName: String
    var unit: String
    var points: [(date: Date, value: Double)]

    func makeChartDescriptor() -> AXChartDescriptor {
        let values = points.map(\.value)
        let lo = values.min() ?? 0
        let hi = max(values.max() ?? 1, lo + 0.1)
        let start = points.first?.date.timeIntervalSince1970 ?? 0
        let end = max(points.last?.date.timeIntervalSince1970 ?? 1, start + 1)
        let unit = unit

        let xAxis = AXNumericDataAxisDescriptor(title: "Date", range: start ... end, gridlinePositions: []) { value in
            Date(timeIntervalSince1970: value).formatted(.dateTime.month(.abbreviated).day())
        }
        let yAxis = AXNumericDataAxisDescriptor(title: seriesName, range: lo ... hi, gridlinePositions: []) { value in
            "\(Fmt.number(value)) \(unit)"
        }
        let series = AXDataSeriesDescriptor(
            name: seriesName,
            isContinuous: true,
            dataPoints: points.map { AXDataPoint(x: $0.date.timeIntervalSince1970, y: $0.value) }
        )

        var summary: String?
        if let first = points.first, let last = points.last, points.count > 1 {
            summary = "\(seriesName) went from \(Fmt.number(first.value)) to \(Fmt.number(last.value)) \(unit) "
                + "between \(first.date.formatted(.dateTime.month(.wide).day())) and \(last.date.formatted(.dateTime.month(.wide).day()))."
        }
        return AXChartDescriptor(title: title, summary: summary, xAxis: xAxis, yAxis: yAxis, additionalAxes: [], series: [series])
    }
}
