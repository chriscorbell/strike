import SwiftUI

/// Floating rest countdown after a logged set, with quick ±15 s and skip.
struct RestTimerBar: View {
    var rest: WorkoutStore.Rest
    var store: WorkoutStore

    var body: some View {
        HStack(spacing: 14) {
            TimelineView(.animation(minimumInterval: 0.2)) { context in
                let remaining = max(0, rest.endsAt.timeIntervalSince(context.date))
                let progress = rest.duration > 0 ? remaining / rest.duration : 0
                ZStack {
                    Circle()
                        .stroke(Color.accentColor.opacity(0.2), lineWidth: 5)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text(format(remaining))
                        .font(.number(size: 15, weight: .bold))
                        .contentTransition(.numericText(countsDown: true))
                }
                .frame(width: 58, height: 58)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Rest")
                .accessibilityValue("\(Int(remaining.rounded(.up))) seconds left")
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Rest")
                    .font(.subheadline.weight(.semibold))
                Text(rest.nextUp)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 6) {
                adjust("−15", seconds: -15, label: "Remove 15 seconds")
                adjust("+15", seconds: 15, label: "Add 15 seconds")
                Button {
                    store.skipRest()
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.subheadline.weight(.bold))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .background(Color(.tertiarySystemFill), in: .circle)
                .accessibilityLabel("Skip rest")
            }
        }
        .padding(.leading, 10)
        .padding(.trailing, 10)
        .padding(.vertical, 10)
        .glassEffect(.regular, in: .rect(cornerRadius: 30, style: .continuous))
    }

    private func adjust(_ title: String, seconds: TimeInterval, label: String) -> some View {
        Button {
            store.adjustRest(by: seconds)
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .frame(width: 48, height: 44)
        }
        .buttonStyle(.plain)
        .background(Color(.tertiarySystemFill), in: .capsule)
        .accessibilityLabel(label)
    }

    private func format(_ seconds: TimeInterval) -> String {
        let s = Int(seconds.rounded(.up))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }
}
