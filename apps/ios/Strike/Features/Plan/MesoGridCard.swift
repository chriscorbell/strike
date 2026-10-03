import SwiftUI

/// Weeks × days of the block. Each cell is a session: done, in progress, skipped, planned, or not
/// scheduled yet. Columns stretch to fill the card when they fit and scroll sideways when they don't.
struct MesoGridCard: View {
    var meso: MesoOverview
    var nextSessionId: Int?
    /// Zero-based week the user is in, when this is the active block.
    var currentWeek: Int?
    var openWorkout: (Int) -> Void

    @ScaledMetric(relativeTo: .caption) private var cellWidth: CGFloat = 58
    @ScaledMetric(relativeTo: .caption) private var cellHeight: CGFloat = 52

    var body: some View {
        ViewThatFits(in: .horizontal) {
            grid(fixedColumns: false)
            ScrollView(.horizontal) {
                grid(fixedColumns: true)
                    .padding(.horizontal, Theme.padding)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            .padding(.horizontal, -Theme.padding)
        }
        .card()
    }

    private func grid(fixedColumns: Bool) -> some View {
        Grid(horizontalSpacing: 6, verticalSpacing: 6) {
            GridRow {
                Color.clear
                    .gridCellUnsizedAxes([.horizontal, .vertical])
                ForEach(meso.days.indices, id: \.self) { day in
                    Text(dayTitle(day))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                        .modifier(ColumnWidth(fixed: fixedColumns, width: cellWidth))
                        .padding(.bottom, 2)
                }
            }
            .accessibilityHidden(true)

            ForEach(meso.grid.indices, id: \.self) { week in
                GridRow {
                    Text(weekTitle(week))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(week == currentWeek ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                        .fixedSize()
                        .gridColumnAlignment(.leading)
                        .accessibilityHidden(true)
                    ForEach(meso.grid[week].indices, id: \.self) { day in
                        cell(week: week, day: day)
                            .modifier(ColumnWidth(fixed: fixedColumns, width: cellWidth))
                            .frame(height: cellHeight)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cell(week: Int, day: Int) -> some View {
        let cell = meso.grid[week][day]
        let isNext = cell != nil && cell?.sessionId == nextSessionId
        let face = MesoGridCell(cell: cell, isNext: isNext)
        let label = accessibilityLabel(cell: cell, week: week, day: day, isNext: isNext)

        switch cell?.status {
        case .planned?, .inProgress?:
            Button {
                if let id = cell?.sessionId { openWorkout(id) }
            } label: {
                face
            }
            .buttonStyle(MesoCellPressStyle())
            .accessibilityLabel(label)
            .accessibilityHint("Opens the workout")
        case .completed?, .skipped?:
            NavigationLink(value: PlanRoute.session(cell?.sessionId ?? 0)) {
                face
            }
            .buttonStyle(MesoCellPressStyle())
            .accessibilityLabel(label)
            .accessibilityHint("Shows the session")
        case nil:
            face
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
        }
    }

    // MARK: Labels

    private var deloadRow: Int? { meso.grid.count > meso.hardWeeks ? meso.grid.count - 1 : nil }

    private func weekTitle(_ week: Int) -> String {
        week == deloadRow ? "Deload" : "W\(week + 1)"
    }

    private func dayTitle(_ day: Int) -> String {
        let label = meso.days[day].label.trimmingCharacters(in: .whitespaces)
        return label.isEmpty ? "D\(day + 1)" : label
    }

    private func accessibilityLabel(cell: MesoOverview.Cell?, week: Int, day: Int, isNext: Bool) -> String {
        var parts = [week == deloadRow ? "Deload week" : "Week \(week + 1)", dayTitle(day)]
        if let cell {
            parts.append(cell.status.displayName.lowercased())
            if let date = cell.date { parts.append(Dates.medium(date)) }
            if isNext { parts.append("next session") }
        } else {
            parts.append("not scheduled yet")
        }
        return parts.joined(separator: ", ")
    }
}

/// Stretches a column to share the card's width, or pins it for the scrolling layout.
private struct ColumnWidth: ViewModifier {
    var fixed: Bool
    var width: CGFloat

    func body(content: Content) -> some View {
        if fixed {
            content.frame(width: width)
        } else {
            content.frame(minWidth: width * 0.85, idealWidth: width, maxWidth: .infinity)
        }
    }
}

/// One session in the grid.
private struct MesoGridCell: View {
    var cell: MesoOverview.Cell?
    var isNext: Bool

    private let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)

    var body: some View {
        ZStack {
            background
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(shape)
        .opacity(cell?.status == .skipped ? 0.55 : 1)
        .animation(Theme.spring, value: cell?.status)
        .animation(Theme.spring, value: isNext)
    }

    @ViewBuilder
    private var background: some View {
        switch cell?.status {
        case nil:
            shape.strokeBorder(Color.secondary.opacity(0.28), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        case .completed?:
            shape.fill(Color.accentColor)
        case .inProgress?:
            shape.fill(Color.accentColor.opacity(0.14))
                .overlay(shape.strokeBorder(Color.accentColor, lineWidth: 2))
        case .skipped?:
            shape.fill(Color(.tertiarySystemFill))
                .overlay(SlashLine().stroke(Color.secondary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round)).padding(12))
        case .planned?:
            if isNext {
                shape.fill(Color.accentColor.opacity(0.1))
                    .overlay(shape.strokeBorder(Color.accentColor.opacity(0.8), lineWidth: 1.5))
            } else {
                shape.strokeBorder(Color.secondary.opacity(0.5), lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let cell {
            VStack(spacing: 2) {
                switch cell.status {
                case .completed:
                    Image(systemName: "checkmark")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.white)
                        .transition(.symbolEffect(.drawOn))
                case .inProgress:
                    Image(systemName: "play.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.tint)
                case .planned where isNext:
                    Text("Next")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.tint)
                case .planned, .skipped:
                    EmptyView()
                }
                if let date = cell.date {
                    Text(Dates.short(date))
                        .font(.caption2.weight(.medium))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .foregroundStyle(cell.status == .completed ? AnyShapeStyle(.white.opacity(0.85)) : AnyShapeStyle(.secondary))
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

/// The diagonal stroke across a skipped session.
private struct SlashLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let side = min(rect.width, rect.height)
        let inset = CGRect(x: rect.midX - side / 2, y: rect.midY - side / 2, width: side, height: side)
        path.move(to: CGPoint(x: inset.minX, y: inset.maxY))
        path.addLine(to: CGPoint(x: inset.maxX, y: inset.minY))
        return path
    }
}

/// A gentle press-down for tappable cells.
private struct MesoCellPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(Theme.snappy, value: configuration.isPressed)
    }
}
