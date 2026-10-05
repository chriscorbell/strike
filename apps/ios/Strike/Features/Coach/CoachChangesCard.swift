import SwiftUI

/// The changes a reply proposes, applied or dismissed together. Applied rows that started coach work
/// show it running, then done or failed.
struct CoachChangesCard: View {
    var message: CoachMessage

    @Environment(CoachStore.self) private var store

    private enum Phase { case proposed, applied, dismissed }

    private var phase: Phase {
        if message.actions.contains(where: { $0.status == .proposed }) { return .proposed }
        return message.actions.contains(where: { $0.status == .applied }) ? .applied : .dismissed
    }

    private var isBusy: Bool { store.busyReplies.contains(message.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(message.actions.enumerated()), id: \.element.id) { index, action in
                if index > 0 {
                    Divider().padding(.leading, 44)
                }
                CoachActionRow(action: action, job: action.jobId.flatMap { store.jobs[$0] })
            }
            footer
                .padding(.top, 10)
        }
        .padding(.horizontal, 14)
        .padding(.top, 4)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        .opacity(phase == .dismissed ? 0.6 : 1)
        .animation(Theme.spring, value: phase)
        .sensoryFeedback(.error, trigger: store.applyErrors[message.id]) { _, new in new != nil }
    }

    @ViewBuilder
    private var footer: some View {
        switch phase {
        case .proposed:
            VStack(alignment: .leading, spacing: 10) {
                if let error = store.applyErrors[message.id] {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.warning)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
                HStack(spacing: 10) {
                    Button {
                        Task { await store.dismissChanges(of: message) }
                    } label: {
                        Text("Dismiss")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 34)
                    }
                    .buttonStyle(.glass)
                    Button {
                        Task { await store.applyChanges(of: message) }
                    } label: {
                        Group {
                            if isBusy {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Apply")
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 34)
                    }
                    .buttonStyle(.glassProminent)
                }
                // Not until the reply is finished: more changes may still arrive.
                .disabled(message.status == .pending || isBusy)
            }
        case .applied:
            Label("Applied", systemImage: "checkmark")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.success)
        case .dismissed:
            Text("Dismissed")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

private struct CoachActionRow: View {
    var action: CoachAction
    /// The coach job this change started, as last polled; nil while it hasn't reported back.
    var job: Job?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            icon
            VStack(alignment: .leading, spacing: 3) {
                Text(action.summary)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(action.status == .dismissed ? Color.secondary : Color.primary)
                if let detail = action.detail, !detail.isEmpty {
                    ExpandableText(text: detail, lineLimit: 2)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if action.status == .applied, action.jobId != nil {
                    jobStatus
                        .padding(.top, 3)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    private var icon: some View {
        let applied = action.status == .applied
        let tint: Color = switch action.status {
        case .proposed: .accentColor
        case .applied: Theme.success
        case .dismissed: .secondary
        }
        return Image(systemName: applied ? "checkmark" : action.kind.symbol)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(tint)
            .contentTransition(.symbolEffect(.replace))
            .frame(width: 32, height: 32)
            .background(tint.opacity(0.14), in: .circle)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var jobStatus: some View {
        switch job?.status {
        case .succeeded:
            Label("Done", systemImage: "checkmark.circle.fill")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.success)
                .transition(.opacity)
        case .failed:
            Label(job?.error ?? "The coach couldn't finish this.", systemImage: "exclamationmark.triangle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.warning)
                .transition(.opacity)
        default:
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.mini)
                Text("The coach is working on it")
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.tint)
            .transition(.opacity)
        }
    }
}

/// Text clamped to a few lines, with More / Less when it doesn't fit.
private struct ExpandableText: View {
    var text: String
    var lineLimit: Int

    @State private var isExpanded = false
    @State private var fullHeight: CGFloat = 0
    @State private var clampedHeight: CGFloat = 0

    private var isTruncated: Bool { fullHeight > clampedHeight + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(text)
                .lineLimit(isExpanded ? nil : lineLimit)
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                    if !isExpanded { clampedHeight = height }
                }
                .background(alignment: .topLeading) {
                    // The whole text, measured off screen.
                    Text(text)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fullHeight = $0 }
                }
            if isTruncated || isExpanded {
                Button(isExpanded ? "Less" : "More") {
                    withAnimation(Theme.snappy) { isExpanded.toggle() }
                }
                .font(.footnote.weight(.semibold))
                .buttonStyle(.borderless)
                .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }
}

extension CoachActionKind {
    var symbol: String {
        switch self {
        case .swapMeal: "fork.knife"
        case .logMeal: "plus"
        case .replanMeals: "menucard"
        case .rewritePrepGuide: "frying.pan"
        case .setDayType: "calendar"
        case .setWorkoutTime: "clock.arrow.2.circlepath"
        case .swapExercise: "arrow.triangle.2.circlepath"
        case .setSessionLocation: "mappin.and.ellipse"
        case .skipSession: "forward.end"
        case .newBlock: "calendar.badge.plus"
        case .saveNote: "note.text"
        case .other: "sparkles"
        }
    }
}
