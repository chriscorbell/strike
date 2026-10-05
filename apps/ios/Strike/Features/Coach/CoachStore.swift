import Foundation
import Observation
import SwiftUI

/// Ask Coach: the open conversation and the reply streaming into it, past conversations, and the
/// changes the coach proposes (apply, dismiss, and the coach work an applied change starts).
@MainActor
@Observable
final class CoachStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    /// Recent conversations, most recently active first; nil until loaded.
    private(set) var threads: [CoachThreadSummary]?
    /// The open conversation; nil for a new one, which starts with its first message.
    private(set) var threadId: Int?
    /// Oldest first.
    private(set) var messages: [CoachMessage] = []
    /// Set once the first load has decided which conversation to show.
    private(set) var hasLoaded = false
    private(set) var loadError: String?
    private(set) var isOpening = false
    /// A message is on its way and the reply hasn't started.
    private(set) var isSending = false
    /// What the coach is doing while no text has arrived since, e.g. "Reading the prep guide".
    private(set) var status: String?
    /// The reply's stream broke while the coach was still writing.
    private(set) var isInterrupted = false
    /// Replies with an apply or dismiss in flight.
    private(set) var busyReplies: Set<Int> = []
    /// Why applying a reply's changes failed, by message id, until the next attempt.
    private(set) var applyErrors: [Int: String] = [:]
    /// Coach jobs started by applied changes, as last polled.
    private(set) var jobs: [Int: Job] = [:]
    /// Bumped when a reply's changes are applied, for the success haptic.
    private(set) var appliedTick = 0
    /// What Chris is typing. Restored when a message can't be sent.
    var draft = ""

    @ObservationIgnored private var streamTask: Task<Void, Never>?
    /// Identifies the current stream, so a cancelled one can't touch state after a new one started.
    @ObservationIgnored private var streamGeneration = 0
    @ObservationIgnored private var isStreaming = false
    @ObservationIgnored private var autoResumes = 0
    /// While following a reply from its start, the replayed text until it catches up with what's shown.
    @ObservationIgnored private var replay: String?
    @ObservationIgnored private var jobWatchers: [Int: Task<Void, Never>] = [:]

    // MARK: Reading

    var pendingReply: CoachMessage? {
        messages.last { $0.role == .assistant && $0.status == .pending }
    }

    /// The coach is answering (or about to), so nothing else can be sent in this conversation.
    var isReplying: Bool { isSending || pendingReply != nil }
    var isEmpty: Bool { threadId == nil && messages.isEmpty }
    var title: String? { threadId.flatMap { id in threads?.first { $0.id == id }?.title } }

    // MARK: Loading

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await load()
    }

    /// Lists conversations and reopens the latest one if it was active in the last six hours.
    func load() async {
        guard app?.api != nil else { return }
        do {
            let list: [CoachThreadSummary] = try await api.get("/api/coach/threads")
            threads = list
            loadError = nil
            if threadId == nil, messages.isEmpty, let recent = list.first,
               let updated = Dates.timestamp(recent.updatedAt), Date.now.timeIntervalSince(updated) < 6 * 3600 {
                await open(recent.id, animated: false)
            }
            // Leaving the tab mid-load cancels it; the next visit tries again.
            guard !Task.isCancelled else { return }
            withAnimation(Theme.spring) { hasLoaded = true }
        } catch is CancellationError {
        } catch {
            if hasLoaded {
                app?.report(error)
            } else {
                loadError = error.localizedDescription
            }
        }
    }

    func loadThreads() async {
        do {
            let list: [CoachThreadSummary] = try await api.get("/api/coach/threads")
            withAnimation(Theme.spring) { threads = list }
        } catch {
            app?.report(error)
        }
    }

    /// Shows a conversation, following its reply if the coach is still writing one.
    func open(_ id: Int, animated: Bool = true) async {
        stopStreaming()
        isOpening = true
        defer { isOpening = false }
        do {
            let thread: CoachThread = try await api.get("/api/coach/threads/\(id)")
            if animated {
                withAnimation(Theme.snappy) { show(thread) }
            } else {
                show(thread)
            }
        } catch {
            app?.report(error)
        }
    }

    /// Starts an empty conversation. A reply still being written elsewhere keeps going on the server.
    func startNew() {
        stopStreaming()
        withAnimation(Theme.snappy) {
            threadId = nil
            messages = []
            resetReplyState()
        }
    }

    func delete(_ thread: CoachThreadSummary) async {
        do {
            let _: OkResponse = try await api.delete("/api/coach/threads/\(thread.id)")
            withAnimation(Theme.spring) { threads?.removeAll { $0.id == thread.id } }
            if threadId == thread.id { startNew() }
        } catch {
            app?.report(error)
        }
    }

    private func show(_ thread: CoachThread) {
        threadId = thread.id
        messages = thread.messages
        resetReplyState()
        upsert(thread.summary, moveToTop: false)
        watchJobs(in: thread.messages)
        if thread.replying { follow(thread.id) }
    }

    /// Reloads the open conversation: after a reply's proposals replaced earlier ones (`unlessReplying`,
    /// so a message sent meanwhile isn't disturbed), or when a lost reply finished meanwhile.
    private func reload(_ id: Int, unlessReplying: Bool = false) async {
        guard let thread: CoachThread = try? await api.get("/api/coach/threads/\(id)"), threadId == id else { return }
        if unlessReplying, isReplying || isStreaming { return }
        withAnimation(Theme.spring) { show(thread) }
    }

    private func resetReplyState() {
        status = nil
        isInterrupted = false
        applyErrors = [:]
        autoResumes = 0
        replay = nil
    }

    private func upsert(_ summary: CoachThreadSummary, moveToTop: Bool = true) {
        var list = threads ?? []
        if !moveToTop, let index = list.firstIndex(where: { $0.id == summary.id }) {
            list[index] = summary
        } else {
            list.removeAll { $0.id == summary.id }
            list.insert(summary, at: 0)
        }
        threads = list
    }

    // MARK: Sending

    /// Sends the draft, or `text` when retrying a failed reply. The draft clears right away and comes
    /// back if the server turns the message down.
    func send(_ text: String? = nil) {
        let body = (text ?? draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, !isReplying else { return }
        if text == nil { draft = "" }
        stopStreaming()
        let generation = streamGeneration
        let threadId = self.threadId
        // Shown until the server's copy arrives with the `start` event.
        let local = CoachMessage(
            id: -1, threadId: threadId ?? 0, role: .user, text: body, status: .done, error: nil, actions: [],
            createdAt: Date.now.ISO8601Format()
        )
        withAnimation(Theme.spring) {
            isSending = true
            resetReplyState()
            messages.append(local)
        }
        streamTask = Task { [weak self] in
            guard let self else { return }
            do {
                let events: AsyncThrowingStream<CoachStreamEvent, Error> = try await self.api.postStream(
                    "/api/coach/messages", CoachMessageRequest(threadId: threadId, text: body)
                )
                guard generation == self.streamGeneration else { return }
                self.isSending = false
                await self.consume(events, generation: generation)
            } catch {
                guard generation == self.streamGeneration else { return }
                withAnimation(Theme.spring) {
                    self.isSending = false
                    self.messages.removeAll { $0.id < 0 }
                }
                if text == nil, self.draft.isEmpty { self.draft = body }
                self.app?.report(error)
            }
        }
    }

    /// Re-sends the message a failed reply answered, as a new message.
    func retry(_ reply: CoachMessage) {
        guard let index = messages.firstIndex(where: { $0.id == reply.id }),
              let asked = messages[..<index].last(where: { $0.role == .user }) else { return }
        send(asked.text)
    }

    // MARK: Streaming

    /// Applies events in order until `done`. A stream that ends early counts as broken.
    private func consume(_ events: AsyncThrowingStream<CoachStreamEvent, Error>, generation: Int) async {
        isStreaming = true
        defer { if generation == streamGeneration { isStreaming = false } }
        do {
            for try await event in events {
                guard generation == streamGeneration else { return }
                handle(event)
            }
        } catch {
            guard generation == streamGeneration, !(error is CancellationError) else { return }
        }
        guard generation == streamGeneration, pendingReply != nil else { return }
        streamBroke()
    }

    private func handle(_ event: CoachStreamEvent) {
        switch event {
        case let .start(thread, message, reply):
            withAnimation(Theme.spring) {
                threadId = thread.id
                messages.removeAll { $0.id < 0 }
                messages.append(message)
                messages.append(reply)
            }
            upsert(thread)
        case let .status(text):
            withAnimation(Theme.snappy) { status = text }
        case let .delta(text):
            if status != nil { withAnimation(Theme.snappy) { status = nil } }
            appendText(text)
        case let .action(action):
            withAnimation(Theme.spring) {
                // Mirrors the server: a reply's first proposal replaces the ones earlier replies left open.
                if pendingReply?.actions.isEmpty == true { dismissEarlierProposals() }
                updatePending { reply in
                    if !reply.actions.contains(where: { $0.id == action.id }) { reply.actions.append(action) }
                }
            }
        case let .done(reply):
            replay = nil
            autoResumes = 0
            withAnimation(Theme.spring) {
                status = nil
                isInterrupted = false
                replace(reply)
            }
            if !reply.actions.isEmpty {
                let id = reply.threadId
                Task { await reload(id, unlessReplying: true) }
            }
        case .unknown:
            break
        }
    }

    /// Appends a delta. While replaying from the start, holds the text back until it passes what's shown.
    private func appendText(_ text: String) {
        guard let shown = pendingReply?.text else { return }
        if var replayed = replay {
            replayed += text
            if replayed.utf8.count >= shown.utf8.count || !shown.hasPrefix(replayed) {
                replay = nil
                updatePending { $0.text = replayed }
            } else {
                replay = replayed
            }
        } else {
            updatePending { $0.text += text }
        }
    }

    private func updatePending(_ change: (inout CoachMessage) -> Void) {
        guard let index = messages.lastIndex(where: { $0.role == .assistant && $0.status == .pending }) else { return }
        change(&messages[index])
    }

    private func replace(_ message: CoachMessage) {
        guard let index = messages.firstIndex(where: { $0.id == message.id }) else { return }
        messages[index] = message
    }

    private func dismissEarlierProposals() {
        for index in messages.indices where messages[index].status != .pending {
            for a in messages[index].actions.indices where messages[index].actions[a].status == .proposed {
                messages[index].actions[a].status = .dismissed
            }
        }
    }

    /// Follows the reply being written in a conversation from its beginning, after the original stream
    /// was lost. A 409 means it finished meanwhile, so the conversation is reloaded instead.
    private func follow(_ id: Int, after delay: Duration? = nil) {
        stopStreaming()
        let generation = streamGeneration
        streamTask = Task { [weak self] in
            if let delay { try? await Task.sleep(for: delay) }
            guard let self, generation == self.streamGeneration else { return }
            do {
                let events: AsyncThrowingStream<CoachStreamEvent, Error> = try await self.api.stream("/api/coach/threads/\(id)/stream")
                guard generation == self.streamGeneration, self.threadId == id else { return }
                self.isInterrupted = false
                // The replay starts from the beginning; keep showing what's here until it catches up.
                self.replay = ""
                await self.consume(events, generation: generation)
            } catch APIError.server(409, _) {
                guard generation == self.streamGeneration else { return }
                self.isInterrupted = false
                await self.reload(id)
            } catch {
                guard generation == self.streamGeneration, !(error is CancellationError) else { return }
                withAnimation(Theme.snappy) { self.isInterrupted = true }
            }
        }
    }

    /// Picks the reply up again on its own a couple of times; after that, Reconnect or coming back to the
    /// app does.
    private func streamBroke() {
        replay = nil
        if autoResumes < 2, let threadId {
            autoResumes += 1
            follow(threadId, after: .seconds(1))
        } else {
            withAnimation(Theme.snappy) {
                status = nil
                isInterrupted = true
            }
        }
    }

    /// Picks the reply back up: from the Reconnect button, and when the app returns to the foreground.
    /// A stream rarely survives the app being suspended, and a dead one would only time out after 20 s,
    /// so a live one is followed afresh too; the replay doesn't disturb the text already shown.
    func resume() {
        guard let threadId, pendingReply != nil, !isSending else { return }
        follow(threadId)
    }

    private func stopStreaming() {
        streamGeneration += 1
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
        isSending = false
        messages.removeAll { $0.id < 0 }
    }

    // MARK: Proposed changes

    /// Applies every change still proposed on a reply, all or none. On a 409 the card stays as it was
    /// and shows why.
    func applyChanges(of message: CoachMessage) async {
        guard !busyReplies.contains(message.id) else { return }
        busyReplies.insert(message.id)
        defer { busyReplies.remove(message.id) }
        withAnimation(Theme.snappy) { applyErrors[message.id] = nil }
        do {
            let updated: CoachMessage = try await api.post("/api/coach/messages/\(message.id)/apply")
            withAnimation(Theme.spring) { replace(updated) }
            appliedTick += 1
            watchJobs(in: [updated])
            await refreshApp()
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            withAnimation(Theme.snappy) { applyErrors[message.id] = error.localizedDescription }
        }
    }

    func dismissChanges(of message: CoachMessage) async {
        guard !busyReplies.contains(message.id) else { return }
        busyReplies.insert(message.id)
        defer { busyReplies.remove(message.id) }
        do {
            let updated: CoachMessage = try await api.post("/api/coach/messages/\(message.id)/dismiss")
            withAnimation(Theme.spring) {
                applyErrors[message.id] = nil
                replace(updated)
            }
        } catch {
            app?.report(error)
        }
    }

    /// Applied changes can touch any tab: Today, the meal plan and prep guide, the training plan.
    private func refreshApp() async {
        app?.coachJobsChanged()
        await app?.today.load()
    }

    /// Polls the coach jobs applied changes started, so their rows can show progress and the result.
    private func watchJobs(in messages: [CoachMessage]) {
        for action in messages.flatMap(\.actions) where action.status == .applied {
            guard let jobId = action.jobId, jobWatchers[jobId] == nil, jobs[jobId]?.status.isFinished != true else { continue }
            jobWatchers[jobId] = Task { [weak self] in
                guard let api = self?.app?.api else { return }
                // A week's meal plan takes the coach about 20 minutes, then its prep guide.
                let done = try? await api.waitForJob(jobId, interval: .seconds(4), timeout: .seconds(3600))
                guard let self else { return }
                self.jobWatchers[jobId] = nil
                guard let done else { return }
                withAnimation(Theme.spring) { self.jobs[jobId] = done }
                // Only a job that just finished changes what the other tabs show.
                guard Date.now.timeIntervalSince(Dates.timestamp(done.updatedAt) ?? .distantPast) < 60 else { return }
                if done.status == .failed {
                    self.app?.show(Toast(message: done.error ?? "The coach couldn't finish that change.", style: .error))
                }
                await self.refreshApp()
            }
        }
    }
}
