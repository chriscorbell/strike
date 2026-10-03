import Foundation
import UserNotifications

/// Local notifications: upcoming meals and the workout for today and tomorrow, and the end of a rest
/// period while the app is in the background.
@MainActor
final class NotificationService {
    weak var app: AppModel?

    private let center = UNUserNotificationCenter.current()
    private let delegate = NotificationDelegate()

    nonisolated static let restIdentifier = "strike.rest"
    private static let planPrefix = "strike.plan."

    init() {
        center.delegate = delegate
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Asks once; later calls return the stored answer.
    @discardableResult
    func requestPermission() async -> Bool {
        switch await authorizationStatus() {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        default:
            return false
        }
    }

    // MARK: Day plan

    /// Replaces previously scheduled meal and workout reminders with the given days' upcoming items.
    func schedule(days: [TodayResponse]) async {
        await removePlanNotifications()
        guard app?.notificationsEnabled == true else { return }
        let status = await authorizationStatus()
        guard status == .authorized || status == .provisional else { return }

        let now = Date.now
        for day in days {
            for item in day.timeline {
                guard let request = request(for: item, on: day.date, after: now) else { continue }
                try? await center.add(request)
            }
        }
        if let week = days.first?.upcomingWeek, let request = groceryRequest(for: week, after: now) {
            try? await center.add(request)
        }
    }

    /// 9:00 on grocery day, once next week's plan and list are ready.
    private func groceryRequest(for week: UpcomingWeek, after now: Date) -> UNNotificationRequest? {
        guard week.ready, let fireDate = Dates.date(at: "09:00", on: week.shoppingDate), fireDate > now else { return nil }
        let content = UNMutableNotificationContent()
        content.title = "Grocery day"
        content.body = "\(week.itemCount) items, about \(Fmt.usdWhole(week.costUsd))"
        content.sound = .default
        content.threadIdentifier = "groceries"
        let components = Dates.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        return UNNotificationRequest(identifier: "\(Self.planPrefix)grocery.\(week.weekStart)", content: content, trigger: trigger)
    }

    func removePlanNotifications() async {
        let pending = await center.pendingNotificationRequests()
        let ids = pending.map(\.identifier).filter { $0.hasPrefix(Self.planPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    private func request(for item: TimelineItem, on day: LocalDate, after now: Date) -> UNNotificationRequest? {
        guard let fireDate = Dates.date(at: item.time, on: day), fireDate > now else { return nil }
        let content = UNMutableNotificationContent()
        content.sound = .default
        let identifier: String

        switch item {
        case let .meal(meal):
            guard meal.log == nil else { return nil }
            content.title = "\(meal.label) · \(Fmt.integer(meal.targets.proteinG))g protein"
            let names = mealSuggestion(meal.options)
            content.body = names.isEmpty ? "\(Fmt.kcal(meal.targets.kcal))" : names
            content.threadIdentifier = "meals"
            identifier = "\(Self.planPrefix)meal.\(day).\(meal.slotIndex)"
        case let .workout(workout):
            guard workout.status == .planned || workout.status == .inProgress else { return nil }
            content.title = "Time to lift · \(workout.label)"
            content.body = "\(workout.exerciseCount) exercises, \(workout.setCount) sets at \(workout.location == .home ? "home" : "the gym")"
            content.threadIdentifier = "workout"
            identifier = "\(Self.planPrefix)workout.\(day)"
        }

        let components = Dates.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        return UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
    }

    private func mealSuggestion(_ options: [MealOption]) -> String {
        let home = options.first { $0.kind == .home }
        let out = options.first { $0.kind == .out }
        switch (home, out) {
        case let (home?, out?):
            return "\(home.name), or \(out.place.map { "\($0): " } ?? "")\(out.name)"
        case let (home?, nil):
            return home.name
        case let (nil, out?):
            return "\(out.place.map { "\($0): " } ?? "")\(out.name)"
        default:
            return ""
        }
    }

    // MARK: Rest timer

    func scheduleRestEnd(at date: Date, nextUp: String) {
        cancelRestEnd()
        let interval = date.timeIntervalSinceNow
        guard interval > 1 else { return }
        let content = UNMutableNotificationContent()
        content.title = "Rest's up"
        content.body = nextUp
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        center.add(UNNotificationRequest(identifier: Self.restIdentifier, content: content, trigger: trigger))
    }

    func cancelRestEnd() {
        center.removePendingNotificationRequests(withIdentifiers: [Self.restIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restIdentifier])
    }
}

/// Shows plan reminders in the foreground but keeps the rest timer silent there; the in-app timer
/// already gives a haptic.
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        if notification.request.identifier == NotificationService.restIdentifier { return [] }
        return [.banner, .list, .sound]
    }
}
