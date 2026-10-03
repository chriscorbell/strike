import SwiftUI

/// One meal option in full: macros, cost and time, then either the recipe (home) or where to go and
/// exactly what to order (out). Used from Today and from the Meals tab.
struct MealOptionDetailView: View {
    var option: MealOption
    /// When set, shows an "Ate this" button.
    var logTitle: String = "Ate this"
    var onLog: (() async -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var logging = false
    @State private var copied = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                stats
                if option.kind == .out {
                    orderSection
                } else {
                    recipeSection
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .background(Theme.screenBackground)
        .navigationTitle(option.name)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if let onLog {
                Button {
                    logging = true
                    Task {
                        await onLog()
                        logging = false
                        dismiss()
                    }
                } label: {
                    Group {
                        if logging {
                            ProgressView().tint(.white)
                        } else {
                            Label(logTitle, systemImage: "checkmark")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(logging)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
            }
        }
        .sensoryFeedback(.success, trigger: copied) { _, new in new }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Tag(
                text: option.kind == .home ? "Cook at home" : "Grab and go",
                systemImage: option.kind == .home ? "frying.pan.fill" : "bag.fill",
                tint: option.kind == .home ? Theme.protein : Theme.carbs
            )
            Text(option.name)
                .font(.title2.weight(.bold))
            if option.hasUsefulSummary {
                Text(option.summary)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var stats: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 0) {
                stat(Fmt.integer(option.macros.kcal), "kcal", .primary)
                stat(Fmt.integer(option.macros.proteinG), "protein", Theme.protein)
                stat(Fmt.integer(option.macros.carbsG), "carbs", Theme.carbs)
                stat(Fmt.integer(option.macros.fatG), "fat", Theme.fat)
            }
            Divider()
            HStack(spacing: 20) {
                Label(option.prepMinutes > 0 ? Fmt.minutes(option.prepMinutes) : "Ready to eat", systemImage: "clock")
                Label(Fmt.usd(option.costUsd), systemImage: "dollarsign.circle")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .monospacedDigit()
        }
        .card()
    }

    private func stat(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.number(.title3))
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var orderSection: some View {
        if let place = option.place, !place.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Where")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Label(place, systemImage: "mappin.and.ellipse")
                    .font(.title3.weight(.semibold))
            }
        }
        if let order = option.order, !order.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Order exactly")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Spacer()
                    Button {
                        UIPasteboard.general.string = order
                        copied = true
                        Task {
                            try? await Task.sleep(for: .seconds(1.5))
                            copied = false
                        }
                    } label: {
                        Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(.footnote.weight(.semibold))
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .buttonStyle(.borderless)
                }
                Text(order)
                    .font(.body)
                    .textSelection(.enabled)
            }
            .card()
        }
        if !option.ingredients.isEmpty {
            ingredients
        }
    }

    @ViewBuilder
    private var recipeSection: some View {
        if !option.ingredients.isEmpty {
            ingredients
        }
        if !option.steps.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Text("Steps")
                    .font(.title3.weight(.semibold))
                ForEach(Array(option.steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text("\(index + 1)")
                            .font(.subheadline.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(.tint)
                            .frame(width: 22, alignment: .trailing)
                        Text(step)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    private var ingredients: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ingredients")
                .font(.title3.weight(.semibold))
            VStack(spacing: 0) {
                ForEach(Array(option.ingredients.enumerated()), id: \.offset) { index, ingredient in
                    HStack(alignment: .firstTextBaseline) {
                        Text(ingredient.item)
                        Spacer(minLength: 12)
                        Text(ingredient.amount)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.trailing)
                    }
                    .font(.body)
                    .padding(.vertical, 10)
                    if index < option.ingredients.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, Theme.padding)
            .padding(.vertical, 4)
            .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
    }
}

extension MealOption {
    /// False for summaries that only repeat the place ("From Chipotle.").
    var hasUsefulSummary: Bool {
        let trimmed = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        if let place, !place.isEmpty {
            let bare = trimmed.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
            if bare == "from \(place.lowercased())" || bare == place.lowercased() { return false }
        }
        return true
    }
}
