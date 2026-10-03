import SwiftUI

/// Shown after finishing: duration, sets, volume and any personal records.
struct WorkoutSummaryView: View {
    var response: CompleteSessionResponse
    var loadUnit: LoadUnit
    var onDone: () -> Void

    @State private var appeared = false

    private var summary: CompleteSessionResponse.Summary { response.summary }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 64, weight: .semibold))
                        .foregroundStyle(.green)
                        .symbolEffect(.bounce, value: appeared)
                        .scaleEffect(appeared ? 1 : 0.6)
                        .opacity(appeared ? 1 : 0)
                    Text("Workout complete")
                        .font(.title.weight(.bold))
                    Text(response.session.label)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 24)

                HStack(spacing: 0) {
                    stat(summary.durationMinutes.map { Fmt.minutes($0) } ?? "—", "Duration")
                    Divider().frame(height: 40)
                    stat("\(summary.setCount)", "Sets")
                    Divider().frame(height: 40)
                    stat(Fmt.integer(summary.volume), "Volume (\(loadUnit.symbol))")
                }
                .card(padding: 18)

                if !summary.prs.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Personal records", systemImage: "trophy.fill")
                            .font(.headline)
                            .foregroundStyle(Theme.carbs)
                        VStack(spacing: 0) {
                            ForEach(Array(summary.prs.enumerated()), id: \.offset) { index, pr in
                                HStack(alignment: .firstTextBaseline) {
                                    Text(pr.name)
                                        .font(.body.weight(.medium))
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("\(Fmt.number(pr.e1rm, decimals: 1)) \(loadUnit.symbol) e1RM")
                                            .font(.number(.subheadline))
                                        if let previous = pr.previous {
                                            Text("was \(Fmt.number(previous, decimals: 1))")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .monospacedDigit()
                                        }
                                    }
                                }
                                .padding(.vertical, 12)
                                if index < summary.prs.count - 1 { Divider() }
                            }
                        }
                        .padding(.horizontal, Theme.padding)
                        .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: onDone) {
                Text("Done")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.1)) { appeared = true }
        }
        .sensoryFeedback(.success, trigger: appeared)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.number(.title3, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}
