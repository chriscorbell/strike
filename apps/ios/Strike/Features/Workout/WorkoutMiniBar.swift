import SwiftUI

/// The tab bar accessory while a workout is minimized: label, progress or rest countdown.
struct WorkoutMiniBar: View {
    @Environment(AppModel.self) private var app
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement

    var body: some View {
        if let store = app.activeWorkout {
            Button {
                app.isWorkoutPresented = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "dumbbell.fill")
                        .foregroundStyle(.tint)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(store.session?.label ?? "Workout")
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                        if placement != .inline {
                            Text("\(store.progress.done) of \(store.progress.total) sets")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                    }
                    Spacer(minLength: 8)
                    if let rest = store.rest {
                        Text(timerInterval: Date.now ... max(rest.endsAt, Date.now), countsDown: true)
                            .font(.number(.subheadline, weight: .bold))
                            .foregroundStyle(.tint)
                    } else if let started = store.startedAt, store.session?.status == .inProgress {
                        Text(started, style: .timer)
                            .font(.number(.subheadline))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 16)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Return to workout, \(store.session?.label ?? "")")
        }
    }
}
