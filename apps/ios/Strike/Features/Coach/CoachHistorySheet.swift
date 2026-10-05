import SwiftUI

/// Past conversations, most recently active first: tap to open, swipe to delete.
struct CoachHistorySheet: View {
    @Environment(CoachStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let threads = store.threads {
                    if threads.isEmpty {
                        ContentUnavailableView("No conversations yet", systemImage: "bubble.left.and.text.bubble.right")
                    } else {
                        list(threads)
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
            }
            .task { await store.loadThreads() }
        }
        .presentationDetents([.medium, .large])
    }

    private func list(_ threads: [CoachThreadSummary]) -> some View {
        List {
            ForEach(threads) { thread in
                Button {
                    dismiss()
                    guard thread.id != store.threadId else { return }
                    Task { await store.open(thread.id) }
                } label: {
                    row(thread)
                }
                .buttonStyle(.plain)
                .swipeActions {
                    Button(role: .destructive) {
                        Task { await store.delete(thread) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func row(_ thread: CoachThreadSummary) -> some View {
        let isOpen = thread.id == store.threadId
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(thread.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.primary)
                    .lineLimit(2)
                if let updated = Dates.timestamp(thread.updatedAt) {
                    Text(updated, format: .relative(presentation: .named))
                        .font(.subheadline)
                        .foregroundStyle(Color.secondary)
                }
            }
            Spacer(minLength: 8)
            if isOpen {
                Image(systemName: "checkmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 2)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isOpen ? [.isButton, .isSelected] : .isButton)
    }
}
