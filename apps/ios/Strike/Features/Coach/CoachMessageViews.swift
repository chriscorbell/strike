import SwiftUI

/// One message: Chris's in a bubble on the trailing side, the coach's as text with its proposed changes.
struct CoachMessageRow: View {
    var message: CoachMessage
    /// Only the latest reply offers "Try again" and shows the coach's progress.
    var isLast: Bool

    var body: some View {
        switch message.role {
        case .user:
            CoachUserBubble(text: message.text)
        case .assistant:
            CoachReply(message: message, isLast: isLast)
        }
    }
}

private struct CoachUserBubble: View {
    var text: String

    var body: some View {
        Text(text)
            .font(.body)
            .textSelection(.enabled)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.accentColor.opacity(0.22), in: .rect(cornerRadius: 20, style: .continuous))
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.leading, 48)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("You")
            .accessibilityValue(text)
    }
}

private struct CoachReply: View {
    var message: CoachMessage
    var isLast: Bool

    @Environment(CoachStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !message.text.isEmpty {
                CoachReplyText(text: message.text)
                    .equatable()
                    .textSelection(.enabled)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Coach")
                    .accessibilityValue(CoachReplyText.plain(message.text))
            }
            switch message.status {
            case .pending:
                if store.isInterrupted && isLast {
                    CoachReconnect()
                } else if message.text.isEmpty || store.status != nil {
                    CoachStatusLine(text: store.status ?? "Thinking")
                }
            case .failed:
                failure
            case .done:
                EmptyView()
            }
            if !message.actions.isEmpty {
                CoachChangesCard(message: message)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(Theme.spring, value: message.status)
    }

    private var failure: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(message.error ?? "The coach couldn't answer.", systemImage: "exclamationmark.triangle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if isLast {
                Button("Try again") { store.retry(message) }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.glass)
                    .disabled(store.isReplying)
            }
        }
    }
}

/// What the coach is doing, pulsing gently while it works.
private struct CoachStatusLine: View {
    var text: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text("\(text)…")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
            .id(text)
            .transition(.opacity.combined(with: .offset(y: reduceMotion ? 0 : 4)))
            .phaseAnimator([1.0, 0.45]) { content, opacity in
                content.opacity(reduceMotion ? 1 : opacity)
            } animation: { _ in
                .easeInOut(duration: 0.9)
            }
            .accessibilityAddTraits(.updatesFrequently)
    }
}

/// Shown when the reply's stream broke and picking it up again on its own didn't work.
private struct CoachReconnect: View {
    @Environment(CoachStore.self) private var store

    var body: some View {
        HStack(spacing: 12) {
            Label("Lost the connection", systemImage: "wifi.exclamationmark")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Reconnect") { store.resume() }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.glass)
        }
    }
}

// MARK: - Reply text

/// A reply's plain text: paragraphs split on blank lines, `- ` lines as bullets, inline `**bold**`.
struct CoachReplyText: View, Equatable {
    let text: String

    private enum Block {
        case paragraph(String)
        case list([(marker: String, text: String)])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(Self.blocks(text).enumerated()), id: \.offset) { _, block in
                switch block {
                case let .paragraph(line):
                    Text(Self.inline(line))
                case let .list(items):
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(item.marker)
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                                Text(Self.inline(item.text))
                            }
                        }
                    }
                }
            }
        }
        .font(.body)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Lets `.equatable()` skip re-parsing replies that didn't change while another one streams.
    nonisolated static func == (lhs: CoachReplyText, rhs: CoachReplyText) -> Bool { lhs.text == rhs.text }

    /// Groups lines into paragraphs and lists. Blank lines end a paragraph; consecutive `- ` (or `1. `)
    /// lines form a list, and an indented line continues the item above it.
    private static func blocks(_ text: String) -> [Block] {
        var blocks: [Block] = []
        var paragraph: [String] = []
        var items: [(marker: String, text: String)] = []

        func flush() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: "\n"))) }
            if !items.isEmpty { blocks.append(.list(items)) }
            paragraph = []
            items = []
        }

        for raw in text.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flush()
            } else if let item = listItem(line) {
                if !paragraph.isEmpty { flush() }
                items.append(item)
            } else if !items.isEmpty, raw.first?.isWhitespace == true {
                items[items.count - 1].text += " " + line
            } else {
                if !items.isEmpty { flush() }
                paragraph.append(line)
            }
        }
        flush()
        return blocks
    }

    private static func listItem(_ line: String) -> (marker: String, text: String)? {
        for bullet in ["- ", "* ", "• "] where line.hasPrefix(bullet) {
            return ("•", String(line.dropFirst(bullet.count)))
        }
        let digits = line.prefix { $0.isNumber }
        if !digits.isEmpty, digits.count <= 2, line.dropFirst(digits.count).hasPrefix(". ") {
            return ("\(digits).", String(line.dropFirst(digits.count + 2)))
        }
        return nil
    }

    private static func inline(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
    }

    /// The text without markdown, for VoiceOver.
    static func plain(_ text: String) -> String {
        String(inline(text).characters)
    }
}
