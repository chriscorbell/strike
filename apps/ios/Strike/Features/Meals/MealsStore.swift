import Foundation
import Observation
import SwiftUI

/// This plan week's menu, its grocery check-offs, and recent meal history.
@MainActor
@Observable
final class MealsStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    private(set) var menu: MealMenu?
    /// A menu job the server reports as queued or running.
    private(set) var pendingJob: Job?
    private(set) var hasLoaded = false
    private(set) var loadError: String?
    private(set) var isRegenerating = false

    private(set) var history: [MealHistoryDay]?
    private(set) var historyError: String?

    /// Grocery item names checked off for the current menu, persisted per menu id.
    private(set) var checkedGroceries: Set<String> = []

    @ObservationIgnored private var checkedMenuId: Int?
    @ObservationIgnored private var jobWatcher: Task<Void, Never>?
    @ObservationIgnored private var watchedJobId: Int?
    @ObservationIgnored private var handledTick = 0

    /// The coach is writing a menu, either on request or from the server's schedule.
    var isCoachWriting: Bool { isRegenerating || pendingJob != nil }

    // MARK: Menu

    func load() async {
        guard app?.api != nil else { return }
        do {
            let response: MenuResponse = try await api.get("/api/menu")
            apply(response)
            loadError = nil
            hasLoaded = true
        } catch is CancellationError {
        } catch {
            if menu == nil {
                loadError = error.localizedDescription
                hasLoaded = true
            } else {
                app?.report(error)
            }
        }
    }

    /// Reloads after coach jobs finish elsewhere, skipping ticks this store caused itself.
    func coachJobsTickChanged(_ tick: Int) async {
        guard tick != handledTick else { return }
        handledTick = tick
        await load()
    }

    private func apply(_ response: MenuResponse) {
        withAnimation(Theme.spring) {
            menu = response.menu
            pendingJob = response.pendingJob
        }
        if let id = response.menu?.id {
            restoreChecked(menuId: id)
        }
        if let job = response.pendingJob, !isRegenerating {
            watch(job)
        }
    }

    /// Asks the coach for a new menu, waits for it, then reloads.
    func regenerate(note: String?) async {
        guard !isRegenerating else { return }
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        withAnimation(Theme.spring) { isRegenerating = true }
        defer { withAnimation(Theme.spring) { isRegenerating = false } }
        do {
            let job: Job = try await api.post("/api/menu/regenerate", NoteRequest(note: trimmed?.isEmpty == false ? trimmed : nil))
            jobWatcher?.cancel()
            watchedJobId = job.id
            withAnimation(Theme.spring) { pendingJob = job }
            let done = try await api.waitForJob(job.id)
            watchedJobId = nil
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't write a new menu.", style: .error))
            } else {
                app?.show(Toast(message: "New menu ready", style: .success))
            }
            await load()
            // Today's meal options come from the menu; let other screens refresh too.
            app?.coachJobsChanged()
            handledTick = app?.coachJobsTick ?? handledTick
        } catch {
            watchedJobId = nil
            app?.report(error)
        }
    }

    /// Polls a pending menu job the server told us about and reloads when it finishes.
    private func watch(_ job: Job) {
        guard watchedJobId != job.id else { return }
        jobWatcher?.cancel()
        watchedJobId = job.id
        jobWatcher = Task { [weak self] in
            guard let api = self?.app?.api else { return }
            let done = try? await api.waitForJob(job.id)
            guard !Task.isCancelled, let self else { return }
            self.watchedJobId = nil
            if let done, done.status == .failed {
                self.app?.show(Toast(message: done.error ?? "The coach couldn't write the menu.", style: .error))
            }
            await self.load()
        }
    }

    // MARK: Groceries

    func isChecked(_ item: GroceryItem) -> Bool {
        checkedGroceries.contains(item.item)
    }

    func toggle(_ item: GroceryItem) {
        if checkedGroceries.contains(item.item) {
            checkedGroceries.remove(item.item)
        } else {
            checkedGroceries.insert(item.item)
        }
        saveChecked()
    }

    func uncheckAllGroceries() {
        checkedGroceries.removeAll()
        saveChecked()
    }

    private func restoreChecked(menuId: Int) {
        guard menuId != checkedMenuId else { return }
        checkedMenuId = menuId
        checkedGroceries = Set(UserDefaults.standard.stringArray(forKey: Self.groceryKey(menuId)) ?? [])
    }

    private func saveChecked() {
        guard let checkedMenuId else { return }
        UserDefaults.standard.set(checkedGroceries.sorted(), forKey: Self.groceryKey(checkedMenuId))
    }

    private static func groceryKey(_ menuId: Int) -> String { "groceries.\(menuId)" }

    // MARK: History

    func loadHistory() async {
        guard app?.api != nil else { return }
        do {
            let days: [MealHistoryDay] = try await api.get("/api/meals/history", query: ["days": "14"])
            withAnimation(Theme.spring) { history = days }
            historyError = nil
        } catch is CancellationError {
        } catch {
            if history == nil {
                historyError = error.localizedDescription
            } else {
                app?.report(error)
            }
        }
    }
}
