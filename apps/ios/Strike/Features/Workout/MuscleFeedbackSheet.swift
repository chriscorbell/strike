import SwiftUI

/// After a muscle's last exercise: pump, workload and joint pain. Drives next week's set counts.
struct MuscleFeedbackSheet: View {
    var store: WorkoutStore
    var muscle: Muscle

    @Environment(\.dismiss) private var dismiss
    @State private var pump: Int?
    @State private var workload: Int?
    @State private var jointPain = false
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    question("Pump", options: FeedbackScale.pump, selection: $pump)
                    question("Workload", options: FeedbackScale.workload, selection: $workload)
                    Toggle(isOn: $jointPain) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Joint pain")
                                .font(.headline)
                            Text("Any aches in the joints during these sets")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tint(.accentColor)
                }
                .padding(20)
            }
            .navigationTitle(muscle.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        saving = true
                        Task {
                            await store.submitFeedback(muscle: muscle, pump: pump, workload: workload, jointPain: jointPain)
                            saving = false
                            dismiss()
                        }
                    } label: {
                        if saving { ProgressView() } else { Text("Save") }
                    }
                    .disabled(saving || (pump == nil && workload == nil && !jointPain))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            let existing = store.feedback(for: muscle)
            pump = existing?.pump
            workload = existing?.workload
            jointPain = existing?.jointPain ?? false
        }
    }

    private func question(_ title: String, options: [String], selection: Binding<Int?>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            ChoiceChips(
                options: options.enumerated().map { (value: $0.offset, label: $0.element) },
                selection: selection,
                height: 52
            )
            .accessibilityLabel(title)
        }
    }
}
