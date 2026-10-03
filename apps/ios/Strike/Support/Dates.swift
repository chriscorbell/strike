import Foundation

/// Helpers for the wire's `"YYYY-MM-DD"` days, `"HH:MM"` times and ISO-8601 timestamps.
enum Dates {
    static var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        cal.locale = .current
        return cal
    }

    // MARK: Local dates

    static func date(from local: LocalDate) -> Date? {
        let parts = local.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    static func localDate(from date: Date) -> LocalDate {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static var today: LocalDate { localDate(from: .now) }

    static func adding(days: Int, to local: LocalDate) -> LocalDate {
        guard let date = date(from: local), let moved = calendar.date(byAdding: .day, value: days, to: date) else { return local }
        return localDate(from: moved)
    }

    static func weekday(of local: LocalDate) -> Weekday? {
        guard let date = date(from: local) else { return nil }
        return calendar.component(.weekday, from: date) - 1
    }

    /// "Saturday, October 3"
    static func long(_ local: LocalDate) -> String {
        guard let date = date(from: local) else { return local }
        return date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    /// "Sat, Oct 3"
    static func medium(_ local: LocalDate) -> String {
        guard let date = date(from: local) else { return local }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "Oct 3"
    static func short(_ local: LocalDate) -> String {
        guard let date = date(from: local) else { return local }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    /// "Today", "Yesterday", or "Sat, Oct 3"
    static func relative(_ local: LocalDate) -> String {
        if local == today { return "Today" }
        if local == adding(days: -1, to: today) { return "Yesterday" }
        if local == adding(days: 1, to: today) { return "Tomorrow" }
        return medium(local)
    }

    // MARK: Times of day

    static func minutes(of time: TimeOfDay) -> Int? {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return parts[0] * 60 + parts[1]
    }

    static func time(fromMinutes minutes: Int) -> TimeOfDay {
        let wrapped = ((minutes % 1440) + 1440) % 1440
        return String(format: "%02d:%02d", wrapped / 60, wrapped % 60)
    }

    /// A `Date` today (or on `day`) at the given local time.
    static func date(at time: TimeOfDay, on day: LocalDate? = nil) -> Date? {
        guard let minutes = minutes(of: time) else { return nil }
        let base = day.flatMap { date(from: $0) } ?? .now
        let start = calendar.startOfDay(for: base)
        return calendar.date(byAdding: .minute, value: minutes, to: start)
    }

    static func timeOfDay(from date: Date) -> TimeOfDay {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return time(fromMinutes: (c.hour ?? 0) * 60 + (c.minute ?? 0))
    }

    /// "6:00 PM" in the user's locale.
    static func display(_ time: TimeOfDay) -> String {
        guard let date = date(at: time) else { return time }
        return date.formatted(date: .omitted, time: .shortened)
    }

    // MARK: Timestamps

    static func timestamp(_ value: Timestamp?) -> Date? {
        guard let value else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    // MARK: Weekdays

    /// ["Sun", "Mon", …] in the user's locale, indexed by `Weekday`.
    static var shortWeekdays: [String] { calendar.shortWeekdaySymbols }
    static var weekdays: [String] { calendar.weekdaySymbols }
    static var veryShortWeekdays: [String] { calendar.veryShortWeekdaySymbols }

    /// Weekdays ordered from the locale's first weekday.
    static var orderedWeekdays: [Weekday] {
        let first = calendar.firstWeekday - 1
        return (0 ..< 7).map { (first + $0) % 7 }
    }
}
