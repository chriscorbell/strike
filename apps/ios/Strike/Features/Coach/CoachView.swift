import SwiftUI

/// The Coach tab: a conversation with the coach, with the composer pinned above the tab bar.
struct CoachView: View {
    @Environment(AppModel.self) private var app
    @Environment(CoachStore.self) private var store

    @State private var isHistoryPresented = false

    var body: some View {
        NavigationStack {
            content
                .background(Theme.screenBackground)
                .navigationTitle("Coach")
                .navigationSubtitle(store.title ?? "")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
                .safeAreaBar(edge: .bottom) {
                    if store.hasLoaded {
                        CoachComposer()
                    }
                }
        }
        .sheet(isPresented: $isHistoryPresented) {
            CoachHistorySheet()
        }
        .task { await store.loadIfNeeded() }
        .sensoryFeedback(.success, trigger: store.appliedTick)
    }

    @ViewBuilder
    private var content: some View {
        if store.hasLoaded {
            CoachConversation()
        } else if let error = store.loadError {
            LoadErrorView(message: error) { await store.load() }
        } else {
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                isHistoryPresented = true
            } label: {
                Image(systemName: "clock.arrow.circlepath")
            }
            .accessibilityLabel("History")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                store.startNew()
            } label: {
                Image(systemName: "square.and.pencil")
            }
            .accessibilityLabel("New conversation")
            .disabled(store.isEmpty || !store.hasLoaded)
        }
        ToolbarSpacer(.fixed, placement: .topBarTrailing)
        ToolbarItem(placement: .topBarTrailing) {
            SettingsToolbarButton()
        }
    }
}

// MARK: - Conversation

/// The messages, kept scrolled to the newest while the reply streams in, unless Chris scrolled up.
private struct CoachConversation: View {
    @Environment(CoachStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var position = ScrollPosition(edge: .bottom)
    /// Follows the bottom as content grows; cleared when Chris scrolls away from it.
    @State private var isPinned = true
    @State private var isDragging = false

    var body: some View {
        ScrollView {
            Group {
                if store.isEmpty {
                    CoachSuggestions()
                } else {
                    messages
                }
            }
            .padding(.horizontal, Theme.padding)
            .padding(.top, 12)
            .padding(.bottom, 16)
            .opacity(store.isOpening ? 0.4 : 1)
        }
        .scrollPosition($position)
        .defaultScrollAnchor(.bottom, for: .initialOffset)
        .defaultScrollAnchor(.bottom, for: .alignment)
        .scrollDismissesKeyboard(.interactively)
        .onScrollPhaseChange { _, phase in
            isDragging = phase == .tracking || phase == .interacting || phase == .decelerating
        }
        .onScrollGeometryChange(for: Bool.self) { geo in
            geo.contentOffset.y + geo.containerSize.height >= geo.contentSize.height + geo.contentInsets.bottom - 40
        } action: { _, atBottom in
            // Growing content moves the bottom away without Chris scrolling; only his scrolling unpins.
            if atBottom || isDragging { isPinned = atBottom }
        }
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            geo.contentSize.height + geo.contentInsets.bottom - geo.containerSize.height
        } action: { old, new in
            guard isPinned, new > old else { return }
            position.scrollTo(edge: .bottom)
        }
        .overlay(alignment: .bottom) {
            ZStack {
                if !isPinned && !store.isEmpty {
                    Button {
                        isPinned = true
                        withAnimation(Theme.spring) { position.scrollTo(edge: .bottom) }
                    } label: {
                        Image(systemName: "arrow.down")
                            .font(.subheadline.weight(.semibold))
                            .frame(width: 40, height: 40)
                    }
                    .buttonStyle(.plain)
                    .glassEffect(.regular.interactive(), in: .circle)
                    .padding(.bottom, 10)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
                    .accessibilityLabel("Scroll to latest")
                }
            }
            .animation(Theme.snappy, value: isPinned)
        }
        .onChange(of: store.messages.last?.id) { _, _ in
            // A new message (Chris's own, or a conversation opened) brings the bottom back.
            isPinned = true
            withAnimation(Theme.spring) { position.scrollTo(edge: .bottom) }
        }
    }

    private var messages: some View {
        let lastId = store.messages.last?.id
        return VStack(alignment: .leading, spacing: 20) {
            ForEach(store.messages) { message in
                CoachMessageRow(message: message, isLast: message.id == lastId)
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 12)))
            }
        }
    }
}

// MARK: - Empty conversation

/// A fresh conversation: a title and a few things to ask that send straight away.
private struct CoachSuggestions: View {
    @Environment(CoachStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private static let suggestions: [(text: String, symbol: String)] = [
        ("I missed my cook day", "frying.pan"),
        ("Move today's workout to tomorrow", "calendar"),
        ("Why did my weights change?", "dumbbell"),
        ("Something lighter for dinner tonight", "leaf"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Ask your coach")
                .font(.title2.weight(.bold))
                .padding(.horizontal, 4)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 8) {
                ForEach(Array(Self.suggestions.enumerated()), id: \.offset) { index, suggestion in
                    Button {
                        store.send(suggestion.text)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: suggestion.symbol)
                                .font(.body)
                                .foregroundStyle(.tint)
                                .frame(width: 24)
                                .accessibilityHidden(true)
                            Text(suggestion.text)
                                .font(.body)
                                .foregroundStyle(Color.primary)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 50)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.smallRadius, style: .continuous))
                    .disabled(store.isReplying)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared || reduceMotion ? 0 : 10)
                    .animation(Theme.spring.delay(Double(index) * 0.04), value: appeared)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear { appeared = true }
    }
}

// MARK: - Composer

/// A growing text field with a send button, above the keyboard and the tab bar.
private struct CoachComposer: View {
    @Environment(CoachStore.self) private var store
    @FocusState private var isFocused: Bool

    private var canSend: Bool {
        !store.isReplying && !store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        @Bindable var store = store
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message", text: $store.draft, axis: .vertical)
                .lineLimit(1 ... 6)
                .focused($isFocused)
                .padding(.leading, 16)
                .padding(.vertical, 11)
                .frame(minHeight: 44)
            Button {
                store.send()
            } label: {
                Group {
                    if store.isSending {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.body.weight(.bold))
                    }
                }
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(canSend || store.isSending ? Color.accentColor : Color(.systemGray3), in: .circle)
                .contentShape(.circle)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .padding(.trailing, 5)
            .padding(.bottom, 5)
            .accessibilityLabel("Send")
            .animation(Theme.snappy, value: canSend)
        }
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 22, style: .continuous))
        .padding(.horizontal, Theme.padding)
        .padding(.bottom, 8)
    }
}
