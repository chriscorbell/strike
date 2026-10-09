import Foundation
import Observation
import SwiftUI

/// Today's plan: meals, the workout, macros, weigh-in and check-in, plus the actions on them.
@MainActor
@Observable
final class TodayStore: AppStore {
    @ObservationIgnored weak var app: AppModel?

    private(set) var data: TodayResponse?
    private(set) var isLoading = false
    private(set) var loadError: String?
    /// Meal slots with a request in flight, so their buttons can show progress.
    private(set) var busySlots: Set<Int> = []
    /// Slots waiting on a "more options" coach job.
    private(set) var optionJobSlots: Set<Int> = []
    /// Meals entered by hand before, most recently eaten first, for logging again.
    private(set) var recentMeals: [RecentMeal] = []
    private(set) var isChangingDay = false
    /// The day on screen; nil follows today.
    private(set) var selectedDate: LocalDate?

    @ObservationIgnored private var jobWatcher: Task<Void, Never>?
    @ObservationIgnored private var notificationTask: Task<Void, Never>?

    var date: LocalDate { selectedDate ?? data?.date ?? app?.state?.today ?? Dates.today }
    var isShowingToday: Bool { selectedDate == nil }

    /// Show another day; nil or today's date goes back to today.
    func show(_ day: LocalDate?) async {
        let target = day == Dates.today ? nil : day
        guard target != selectedDate else { return }
        selectedDate = target
        await load()
    }

    func step(by days: Int) async {
        await show(Dates.adding(days: days, to: date))
    }

    // MARK: Loading

    func load() async {
        guard app?.api != nil else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: TodayResponse = try await api.get("/api/today", query: selectedDate.map { ["date": $0] } ?? [:])
            apply(response)
            loadError = nil
            Task { await refreshRecentMeals() }
        } catch is CancellationError {
        } catch {
            if data == nil {
                loadError = error.localizedDescription
            } else {
                app?.report(error)
            }
        }
    }

    private func apply(_ response: TodayResponse) {
        withAnimation(Theme.spring) { data = response }
        watchJobs(response.pendingJobs)
        if selectedDate == nil { scheduleNotifications(today: response) }
    }

    // MARK: Meals

    func log(_ option: MealOption, for meal: TimelineMeal) async {
        await logMeal(slotIndex: meal.slotIndex, request: MealLogRequest(
            date: date, slotIndex: meal.slotIndex, optionId: option.id, custom: nil, status: .eaten
        ))
    }

    func logCustom(name: String, macros: Macros, slotIndex: Int?) async {
        await logMeal(slotIndex: slotIndex, request: MealLogRequest(
            date: date, slotIndex: slotIndex, optionId: nil, custom: .init(name: name, macros: macros), status: .eaten
        ))
    }

    private func refreshRecentMeals() async {
        guard let recent: [RecentMeal] = try? await api.get("/api/meals/recent") else { return }
        recentMeals = recent
    }

    func skip(_ meal: TimelineMeal) async {
        await logMeal(slotIndex: meal.slotIndex, request: MealLogRequest(
            date: date, slotIndex: meal.slotIndex, optionId: nil, custom: nil, status: .skipped
        ))
    }

    private func logMeal(slotIndex: Int?, request: MealLogRequest) async {
        if let slotIndex { busySlots.insert(slotIndex) }
        defer { if let slotIndex { busySlots.remove(slotIndex) } }
        do {
            let log: MealLog = try await api.post("/api/meals/log", request)
            applyLocally(log)
            await load()
        } catch {
            app?.report(error)
        }
    }

    func undo(_ log: MealLog) async {
        if let slot = log.slotIndex { busySlots.insert(slot) }
        defer { if let slot = log.slotIndex { busySlots.remove(slot) } }
        do {
            let _: OkResponse = try await api.delete("/api/meals/log/\(log.id)")
            removeLocally(log)
            await load()
        } catch {
            app?.report(error)
        }
    }

    /// Optimistic update so the timeline reacts before the reload lands.
    private func applyLocally(_ log: MealLog) {
        guard var data else { return }
        if let slot = log.slotIndex {
            data.timeline = data.timeline.map { item in
                guard case var .meal(meal) = item, meal.slotIndex == slot else { return item }
                if let old = meal.log, old.status == .eaten { data.consumed = data.consumed - old.macros }
                meal.log = log
                return .meal(meal)
            }
        } else {
            data.extraMeals.append(log)
        }
        if log.status == .eaten { data.consumed = data.consumed + log.macros }
        withAnimation(Theme.spring) { self.data = data }
    }

    private func removeLocally(_ log: MealLog) {
        guard var data else { return }
        data.timeline = data.timeline.map { item in
            guard case var .meal(meal) = item, meal.log?.id == log.id else { return item }
            meal.log = nil
            return .meal(meal)
        }
        data.extraMeals.removeAll { $0.id == log.id }
        if log.status == .eaten { data.consumed = data.consumed - log.macros }
        withAnimation(Theme.spring) { self.data = data }
    }

    /// Asks the coach for more options for a slot and reloads once they arrive.
    func requestMoreOptions(for meal: TimelineMeal) async {
        optionJobSlots.insert(meal.slotIndex)
        defer { optionJobSlots.remove(meal.slotIndex) }
        do {
            let job: Job = try await api.post("/api/meals/more-options", MoreOptionsRequest(date: date, slotIndex: meal.slotIndex))
            let done = try await api.waitForJob(job.id)
            if done.status == .failed {
                app?.show(Toast(message: done.error ?? "The coach couldn't find more options.", style: .error))
            } else {
                let count = (try? done.decodeResult(as: [MealOption].self).count) ?? 0
                await load()
                app?.show(Toast(message: count == 1 ? "1 new option" : "\(count) new options", style: .success))
            }
        } catch {
            app?.report(error)
        }
    }

    /// Estimates macros for a described meal. Throws when the coach job fails.
    func estimate(_ description: String) async throws -> MealEstimate {
        let job: Job = try await api.post("/api/meals/estimate", EstimateRequest(description: description))
        let done = try await api.waitForJob(job.id)
        guard done.status == .succeeded else {
            throw APIError.server(status: 0, message: done.error ?? "The coach couldn't estimate that meal.")
        }
        return try done.decodeResult(as: MealEstimate.self)
    }

    // MARK: Day

    func setWorkoutTime(_ time: TimeOfDay?) async {
        do {
            let response: TodayResponse = try await api.put("/api/days/\(date)/workout-time", WorkoutTimeRequest(time: time))
            apply(response)
        } catch {
            app?.report(error)
        }
    }

    func setDayType(_ type: DayType) async {
        isChangingDay = true
        defer { isChangingDay = false }
        do {
            let path = type == .training ? "/api/days/\(date)/train" : "/api/days/\(date)/rest"
            let response: TodayResponse = try await api.post(path)
            apply(response)
        } catch {
            app?.report(error)
        }
    }

    // MARK: Weight and check-in

    func logWeight(kg: Double) async -> Bool {
        do {
            let _: WeightEntry = try await api.post("/api/weights", WeightEntry(date: date, weightKg: kg, source: .manual))
            await load()
            return true
        } catch {
            app?.report(error)
            return false
        }
    }

    func runCheckIn(note: String?) async -> CheckIn? {
        do {
            let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
            let checkIn: CheckIn = try await api.post("/api/checkins/run", NoteRequest(note: trimmed?.isEmpty == false ? trimmed : nil))
            await load()
            await app?.refreshState()
            return checkIn
        } catch {
            app?.report(error)
            return nil
        }
    }

    /// A session changed elsewhere (started, finished, skipped); refresh the workout card.
    func markWorkoutChanged() {
        Task { await load() }
    }

    // MARK: Coach jobs

    /// While jobs are pending, polls them and reloads when any finish.
    private func watchJobs(_ pending: [Job]) {
        jobWatcher?.cancel()
        guard !pending.isEmpty else { return }
        let ids = Set(pending.map(\.id))
        jobWatcher = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                guard !Task.isCancelled, let self, let api = self.app?.api else { return }
                guard let jobs: [Job] = try? await api.get("/api/jobs", query: ["pending": "1"]) else { continue }
                let still = Set(jobs.map(\.id))
                if !ids.isSubset(of: still) || jobs.count != ids.count {
                    self.app?.coachJobsChanged()
                    await self.load()
                    return
                }
            }
        }
    }

    // MARK: Notifications

    private func scheduleNotifications(today: TodayResponse) {
        guard let app, app.notificationsEnabled else { return }
        notificationTask?.cancel()
        notificationTask = Task { [weak self] in
            guard let self, let api = self.app?.api else { return }
            let tomorrow: TodayResponse? = try? await api.get("/api/today", query: ["date": Dates.adding(days: 1, to: today.date)])
            guard !Task.isCancelled else { return }
            await self.app?.notifications.schedule(days: [today] + (tomorrow.map { [$0] } ?? []))
            // Prep reminders come from the menus' guides; loading them reschedules.
            await self.app?.meals.refreshIfStale()
        }
    }
}

extension Macros {
    static func + (lhs: Macros, rhs: Macros) -> Macros {
        Macros(kcal: lhs.kcal + rhs.kcal, proteinG: lhs.proteinG + rhs.proteinG, carbsG: lhs.carbsG + rhs.carbsG, fatG: lhs.fatG + rhs.fatG)
    }

    static func - (lhs: Macros, rhs: Macros) -> Macros {
        Macros(kcal: max(0, lhs.kcal - rhs.kcal), proteinG: max(0, lhs.proteinG - rhs.proteinG), carbsG: max(0, lhs.carbsG - rhs.carbsG), fatG: max(0, lhs.fatG - rhs.fatG))
    }
}
