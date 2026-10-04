import Foundation
import Observation
import SwiftUI

enum MealsSection: String, CaseIterable, Identifiable, Sendable {
    case plan
    case groceries
    case prep

    var id: String { rawValue }

    var title: String {
        switch self {
        case .plan: "Plan"
        case .groceries: "Groceries"
        case .prep: "Prep"
        }
    }
}

/// Where the Meals tab should open, e.g. next week's groceries from Today's card.
struct MealsFocus: Equatable, Sendable {
    var week: MenuWeek
    var section: MealsSection
}

/// One cooking session of one version of a menu's guide; a rewritten guide starts unchecked.
struct CookKey: Hashable, Sendable {
    var menuId: Int
    var session: Int
    /// The guide's `createdAt`.
    var version: String
}

/// What's been checked off in cook mode, by index into each list.
struct CookProgress: Codable, Hashable, Sendable {
    var equipment: Set<Int> = []
    var ingredients: Set<Int> = []
    var steps: Set<Int> = []
    var containers: Set<Int> = []

    private static func defaultsKey(_ key: CookKey) -> String { "cook.\(key.menuId).\(key.session).\(key.version)" }

    static func load(_ key: CookKey) -> CookProgress {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey(key)),
              let progress = try? JSONDecoder().decode(CookProgress.self, from: data) else { return CookProgress() }
        return progress
    }

    func save(_ key: CookKey) {
        UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: Self.defaultsKey(key))
    }
}

/// A meal in a week's plan: which day and slot.
struct PlanSlotRef: Hashable, Identifiable, Sendable {
    var week: MenuWeek
    var date: LocalDate
    var dayType: DayType
    var slotIndex: Int

    var id: String { "\(week.rawValue)-\(date)-\(slotIndex)" }
}

/// This week's and next week's menus with their day-by-day plans, grocery check-offs, and recent
/// meal history.
@MainActor
@Observable
final class MealsStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    var week: MenuWeek = .current
    var section: MealsSection = .plan

    private(set) var responses: [MenuWeek: MenuResponse] = [:]
    private(set) var loadErrors: [MenuWeek: String] = [:]
    private(set) var regenerating: Set<MenuWeek> = []
    /// Plan slots with a change or a "suggest more" job in flight.
    private(set) var planning: Set<PlanSlotRef> = []
    private(set) var suggesting: Set<PlanSlotRef> = []

    private(set) var history: [MealHistoryDay]?
    private(set) var historyError: String?

    /// Checked grocery item names, per menu id, persisted on the device.
    private(set) var checked: [Int: Set<String>] = [:]

    /// Menus whose prep guide is being written at our request.
    private(set) var writingGuides: Set<Int> = []
    /// Menus fetched by id (`GET /api/menus/:id`) for cook mode, when they aren't this or next week's.
    private(set) var otherMenus: [Int: MealMenu] = [:]
    /// Cook-mode check-offs, keyed by `CookKey`, persisted on the device.
    private(set) var cookProgress: [CookKey: CookProgress] = [:]

    @ObservationIgnored private var lastLoaded: Date?
    @ObservationIgnored private var guideWatcher: Task<Void, Never>?

    @ObservationIgnored private var watchers: [MenuWeek: Task<Void, Never>] = [:]
    @ObservationIgnored private var watchedJobs: [MenuWeek: Int] = [:]
    @ObservationIgnored private var handledTick = 0

    // MARK: Reading

    func response(for week: MenuWeek) -> MenuResponse? { responses[week] }
    func menu(for week: MenuWeek) -> MealMenu? { responses[week]?.menu }
    func hasLoaded(_ week: MenuWeek) -> Bool { responses[week] != nil || loadErrors[week] != nil }

    /// The coach is writing this week's menu, on request or from the server's schedule.
    func isCoachWriting(_ week: MenuWeek) -> Bool {
        regenerating.contains(week) || responses[week]?.pendingJob != nil
    }

    func slot(in menu: MealMenu, dayType: DayType, slotIndex: Int) -> MenuSlot? {
        menu.slots.first { $0.dayType == dayType && $0.slotIndex == slotIndex }
    }

    func option(in menu: MealMenu, id: String) -> MealOption? {
        for slot in menu.slots {
            if let option = slot.options.first(where: { $0.id == id }) { return option }
        }
        return nil
    }

    // MARK: Loading

    func loadAll() async {
        async let current: Void = load(.current)
        async let next: Void = load(.next)
        _ = await (current, next)
        lastLoaded = .now
        watchPendingGuides()
        await schedulePrepReminders()
    }

    /// Loads both weeks if they're missing or older than a few minutes; used before scheduling reminders.
    func refreshIfStale() async {
        if let lastLoaded, Date.now.timeIntervalSince(lastLoaded) < 300, responses[.current] != nil { return }
        await loadAll()
    }

    func load(_ week: MenuWeek) async {
        guard app?.api != nil else { return }
        do {
            let response: MenuResponse = try await api.get("/api/menu", query: ["week": week.rawValue])
            apply(response, for: week)
            loadErrors[week] = nil
        } catch is CancellationError {
        } catch {
            if responses[week] == nil {
                loadErrors[week] = error.localizedDescription
            } else {
                app?.report(error)
            }
        }
    }

    /// Reloads after coach jobs finish elsewhere, skipping ticks this store caused itself.
    func coachJobsTickChanged(_ tick: Int) async {
        guard tick != handledTick else { return }
        handledTick = tick
        await loadAll()
    }

    private func apply(_ response: MenuResponse, for week: MenuWeek) {
        withAnimation(Theme.spring) { responses[week] = response }
        if let id = response.menu?.id { restoreChecked(menuId: id) }
        if let job = response.pendingJob, !regenerating.contains(week) {
            watch(job, week: week)
        }
    }

    private func replace(_ menu: MealMenu, in week: MenuWeek) {
        guard var response = responses[week] else { return }
        response.menu = menu
        withAnimation(Theme.spring) { responses[week] = response }
    }

    /// Polls a pending menu job the server reported and reloads that week when it finishes.
    private func watch(_ job: Job, week: MenuWeek) {
        guard watchedJobs[week] != job.id else { return }
        watchers[week]?.cancel()
        watchedJobs[week] = job.id
        watchers[week] = Task { [weak self] in
            guard let api = self?.app?.api else { return }
            let done = try? await api.waitForJob(job.id)
            guard !Task.isCancelled, let self else { return }
            self.watchedJobs[week] = nil
            if let done, done.status == .failed {
                self.app?.show(Toast(message: done.error ?? "The coach couldn't write the menu.", style: .error))
            }
            await self.load(week)
            if week == .current { await self.app?.today.load() }
        }
    }

    // MARK: Coach

    /// Asks the coach to write a new menu for a week, waits for it, then reloads.
    func regenerate(note: String?, week: MenuWeek) async {
        guard !regenerating.contains(week) else { return }
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        withAnimation(Theme.spring) { _ = regenerating.insert(week) }
        defer { withAnimation(Theme.spring) { _ = regenerating.remove(week) } }
        do {
            let request = RegenerateMenuRequest(note: trimmed?.isEmpty == false ? trimmed : nil, week: week)
            let job: Job = try await api.post("/api/menu/regenerate", request)
            watchers[week]?.cancel()
            watchedJobs[week] = job.id
            let done = try await api.waitForJob(job.id)
            watchedJobs[week] = nil
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't write a new menu.", style: .error))
            } else {
                app?.show(Toast(message: week == .next ? "Next week's menu is ready" : "New menu ready", style: .success))
            }
            await load(week)
            // Today's meals and the upcoming-week card come from these menus.
            app?.coachJobsChanged()
            handledTick = app?.coachJobsTick ?? handledTick
            await app?.today.load()
        } catch {
            watchedJobs[week] = nil
            app?.report(error)
        }
    }

    /// Plans a different option for one meal; the grocery list is recomputed by the server.
    @discardableResult
    func plan(_ ref: PlanSlotRef, optionId: String) async -> Bool {
        guard let menu = menu(for: ref.week) else { return false }
        planning.insert(ref)
        defer { planning.remove(ref) }
        do {
            let updated: MealMenu = try await api.put(
                "/api/menu/\(menu.id)/plan",
                PlanMealRequest(date: ref.date, slotIndex: ref.slotIndex, optionId: optionId)
            )
            replace(updated, in: ref.week)
            // Today shows this week's planned dishes and next week's grocery total.
            if ref.week == .current || app?.today.data?.upcomingWeek != nil {
                await app?.today.load()
            }
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    /// Asks the coach for more options for one meal; they're added to that week's menu slot.
    func suggestMore(for ref: PlanSlotRef) async {
        suggesting.insert(ref)
        defer { suggesting.remove(ref) }
        do {
            let job: Job = try await api.post("/api/meals/more-options", MoreOptionsRequest(date: ref.date, slotIndex: ref.slotIndex))
            let done = try await api.waitForJob(job.id)
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't find more options.", style: .error))
                return
            }
            let count = (try? done.decodeResult(as: [MealOption].self).count) ?? 0
            await load(ref.week)
            app?.show(Toast(message: count == 1 ? "1 new option" : "\(count) new options", style: .success))
        } catch {
            app?.report(error)
        }
    }

    // MARK: Prep guide

    /// The menu with this id, from either week or fetched on its own.
    func menu(id: Int) -> MealMenu? {
        responses.values.lazy.compactMap(\.menu).first { $0.id == id } ?? otherMenus[id]
    }

    /// Makes sure a menu is available for cook mode, fetching it by id if it isn't one of the two weeks.
    func ensureMenu(id: Int) async {
        if menu(id: id) == nil { await loadAll() }
        guard menu(id: id) == nil else { return }
        do {
            let menu: MealMenu = try await api.get("/api/menus/\(id)")
            otherMenus[id] = menu
        } catch {
            app?.report(error)
        }
    }

    func isWritingGuide(_ menu: MealMenu) -> Bool {
        writingGuides.contains(menu.id) || menu.prepGuidePending
    }

    /// Writes or rewrites a menu's prep guide, waits for the job, then reloads.
    func writePrepGuide(for menu: MealMenu) async {
        guard !writingGuides.contains(menu.id) else { return }
        withAnimation(Theme.spring) { _ = writingGuides.insert(menu.id) }
        defer { withAnimation(Theme.spring) { _ = writingGuides.remove(menu.id) } }
        do {
            let job: Job = try await api.post("/api/menu/\(menu.id)/prep-guide")
            let done = try await api.waitForJob(job.id)
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't write the prep guide.", style: .error))
            } else {
                app?.show(Toast(message: "Prep guide ready", style: .success))
            }
            await loadAll()
            await app?.today.load()
        } catch {
            app?.report(error)
        }
    }

    /// While the server is writing a guide on its own (e.g. after a new plan), reloads until it's done.
    private func watchPendingGuides() {
        let pending = responses.values.compactMap(\.menu).contains(where: \.prepGuidePending)
        guard pending, guideWatcher == nil else { return }
        guideWatcher = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard let self, !Task.isCancelled else { return }
            self.guideWatcher = nil
            await self.loadAll()
            let stillPending = self.responses.values.compactMap(\.menu).contains(where: \.prepGuidePending)
            if !stillPending { await self.app?.today.load() }
        }
    }

    func cookProgress(_ key: CookKey) -> CookProgress {
        cookProgress[key] ?? CookProgress.load(key)
    }

    func updateCookProgress(_ key: CookKey, _ change: (inout CookProgress) -> Void) {
        var progress = cookProgress(key)
        change(&progress)
        cookProgress[key] = progress
        progress.save(key)
    }

    /// Schedules the next week of guide reminders from both menus.
    func schedulePrepReminders() async {
        let today = app?.today.data?.date ?? Dates.today
        let horizon = Dates.adding(days: 7, to: today)
        var reminders: [PrepGuide.Reminder] = []
        var seen = Set<String>()
        for menu in responses.values.compactMap(\.menu) {
            for reminder in menu.prepGuide?.reminders ?? [] where reminder.date >= today && reminder.date < horizon {
                let id = "\(reminder.date)|\(reminder.time ?? "")|\(reminder.text)"
                if seen.insert(id).inserted { reminders.append(reminder) }
            }
        }
        await app?.notifications.schedulePrep(reminders)
    }

    // MARK: Groceries

    func isChecked(_ item: GroceryItem, menuId: Int) -> Bool {
        checked[menuId]?.contains(item.item) == true
    }

    func toggle(_ item: GroceryItem, menuId: Int) {
        var set = checked[menuId] ?? []
        if set.contains(item.item) { set.remove(item.item) } else { set.insert(item.item) }
        checked[menuId] = set
        saveChecked(menuId: menuId)
    }

    func uncheckAll(menuId: Int) {
        checked[menuId] = []
        saveChecked(menuId: menuId)
    }

    private func restoreChecked(menuId: Int) {
        guard checked[menuId] == nil else { return }
        checked[menuId] = Set(UserDefaults.standard.stringArray(forKey: Self.groceryKey(menuId)) ?? [])
    }

    private func saveChecked(menuId: Int) {
        UserDefaults.standard.set((checked[menuId] ?? []).sorted(), forKey: Self.groceryKey(menuId))
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
