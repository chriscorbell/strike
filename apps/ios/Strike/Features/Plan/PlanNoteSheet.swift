import SwiftUI

/// A short form with one multi-line note and a submit action. Used for regenerating the block,
/// writing to the coach and running a check-in.
struct PlanNoteSheet: View {
    struct Confirmation {
        var title: String
        var message: String
        var action: String
    }

    var title: String
    var prompt: String
    var footer: String
    var submitLabel: String
    var requiresNote = false
    var confirmation: Confirmation?
    /// Gets the trimmed note (nil when empty); returns true to close the sheet.
    var submit: @MainActor (String?) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var note = ""
    @State private var isSubmitting = false
    @State private var isConfirming = false
    @State private var submitted = 0
    @FocusState private var isFocused: Bool

    private var trimmed: String? {
        let value = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(prompt, text: $note, axis: .vertical)
                        .lineLimit(4 ... 10)
                        .focused($isFocused)
                        .disabled(isSubmitting)
                } footer: {
                    Text(footer)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Button(submitLabel) {
                            if confirmation != nil {
                                isConfirming = true
                            } else {
                                send()
                            }
                        }
                        .fontWeight(.semibold)
                        .disabled(requiresNote && trimmed == nil)
                        .confirmationDialog(
                            confirmation?.title ?? "",
                            isPresented: $isConfirming,
                            titleVisibility: .visible
                        ) {
                            Button(confirmation?.action ?? submitLabel, role: .destructive) { send() }
                        } message: {
                            Text(confirmation?.message ?? "")
                        }
                    }
                }
            }
            .onAppear { isFocused = true }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(isSubmitting)
        .sensoryFeedback(.success, trigger: submitted)
    }

    private func send() {
        isSubmitting = true
        Task {
            let ok = await submit(trimmed)
            isSubmitting = false
            if ok {
                submitted += 1
                dismiss()
            }
        }
    }
}
