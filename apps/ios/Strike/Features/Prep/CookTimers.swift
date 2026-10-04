import Foundation
import Observation
import SwiftUI

/// Kitchen timers from cook mode. Several can run at once; each also schedules a local notification
/// so it sounds with the phone locked, and they keep running while you browse elsewhere in the app.
@MainActor
@Observable
final class CookTimers {
    struct Key: Hashable, Codable, Sendable {
        var menuId: Int
        var session: Int
        var step: Int

        var id: String { "\(menuId).\(session).\(step)" }
    }

    struct Timer: Equatable, Codable, Sendable {
        var startedAt: Date
        var endsAt: Date
        var finished = false

        var duration: TimeInterval { endsAt.timeIntervalSince(startedAt) }
    }

    @ObservationIgnored weak var app: AppModel?

    private(set) var timers: [Key: Timer] = [:]
    /// Bumps when a timer ends, for a haptic wherever the app is.
    private(set) var finishedTick = 0

    @ObservationIgnored private var tasks: [Key: Task<Void, Never>] = [:]

    private static let defaultsKey = "cookTimers"

    /// Restores timers from a previous launch, so a countdown survives the app being closed.
    init() {
        guard let data = UserDefaults.standard.data(forKey: Self.defaultsKey),
              let saved = try? JSONDecoder().decode([Key: Timer].self, from: data) else { return }
        let now = Date.now
        for (key, var timer) in saved where timer.endsAt.addingTimeInterval(3600) > now {
            if timer.endsAt <= now { timer.finished = true }
            timers[key] = timer
            if !timer.finished { watch(key, until: timer.endsAt) }
        }
    }

    private func save() {
        UserDefaults.standard.set(try? JSONEncoder().encode(timers), forKey: Self.defaultsKey)
    }

    private func watch(_ key: Key, until end: Date) {
        tasks[key]?.cancel()
        tasks[key] = Task { [weak self] in
            try? await Task.sleep(for: .seconds(end.timeIntervalSinceNow))
            guard !Task.isCancelled, let self else { return }
            withAnimation(Theme.spring) { self.timers[key]?.finished = true }
            self.finishedTick += 1
            self.save()
        }
    }

    var hasRunning: Bool { timers.values.contains { !$0.finished } }

    func timer(_ key: Key) -> Timer? { timers[key] }

    func start(_ key: Key, minutes: Int, title: String, step: String) {
        let now = Date.now
        let timer = Timer(startedAt: now, endsAt: now.addingTimeInterval(TimeInterval(minutes * 60)))
        withAnimation(Theme.spring) { timers[key] = timer }
        let body = step.count > 120 ? String(step.prefix(117)) + "…" : step
        app?.notifications.scheduleCookTimer(id: key.id, at: timer.endsAt, title: "\(title): timer done", body: body)
        watch(key, until: timer.endsAt)
        save()
    }

    /// Stops a running timer or clears a finished one.
    func stop(_ key: Key) {
        tasks[key]?.cancel()
        tasks[key] = nil
        app?.notifications.cancelCookTimer(id: key.id)
        withAnimation(Theme.spring) { timers[key] = nil }
        save()
    }

    func stopAll(menuId: Int, session: Int) {
        for key in timers.keys where key.menuId == menuId && key.session == session {
            stop(key)
        }
    }
}
