// Ask Coach: mirrors of the chat types in packages/core (schemas.ts and api.ts). docs/api.md describes
// the routes and the event stream.
import Foundation

/// What a proposed change does. Each kind maps to one thing the app can already do.
enum CoachActionKind: String, Codable, Sendable {
    case swapMeal = "swap_meal"
    case logMeal = "log_meal"
    case replanMeals = "replan_meals"
    case rewritePrepGuide = "rewrite_prep_guide"
    case setDayType = "set_day_type"
    case setWorkoutTime = "set_workout_time"
    case swapExercise = "swap_exercise"
    case setSessionLocation = "set_session_location"
    case skipSession = "skip_session"
    case newBlock = "new_block"
    case saveNote = "save_note"
    /// A kind this build doesn't know yet; decoding never fails on new server actions.
    case other

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CoachActionKind(rawValue: raw) ?? .other
    }
}

enum CoachActionStatus: String, Codable, Sendable {
    case proposed
    case applied
    case dismissed
}

/// A change the coach proposed in a reply. Nothing happens until it's applied.
struct CoachAction: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var kind: CoachActionKind
    /// One line saying what applying it does.
    var summary: String
    /// A second line when useful: the note passed along, or how long the coach's work takes.
    var detail: String?
    var status: CoachActionStatus
    /// Once applied: the coach job it started (a re-plan, a prep guide, a block), if any.
    var jobId: Int?
}

enum CoachRole: String, Codable, Sendable {
    case user
    case assistant
}

enum CoachMessageStatus: String, Codable, Sendable {
    case pending
    case done
    case failed
}

struct CoachMessage: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var threadId: Int
    var role: CoachRole
    var text: String
    /// A reply is pending while the coach writes it, and failed if it couldn't finish.
    var status: CoachMessageStatus
    var error: String?
    var actions: [CoachAction]
    var createdAt: Timestamp
}

/// `POST /api/coach/messages`. `threadId` is sent as `null` to start a new conversation.
struct CoachMessageRequest: Encodable, Sendable {
    var threadId: Int?
    var text: String

    private enum CodingKeys: String, CodingKey { case threadId, text }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(threadId, forKey: .threadId)
        try c.encode(text, forKey: .text)
    }
}

struct CoachThreadSummary: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    /// The start of the first message.
    var title: String
    var createdAt: Timestamp
    var updatedAt: Timestamp
}

struct CoachThread: Codable, Hashable, Identifiable, Sendable {
    var id: Int
    var title: String
    var createdAt: Timestamp
    var updatedAt: Timestamp
    /// The coach is writing a reply right now.
    var replying: Bool
    /// Oldest first.
    var messages: [CoachMessage]

    var summary: CoachThreadSummary {
        CoachThreadSummary(id: id, title: title, createdAt: createdAt, updatedAt: updatedAt)
    }
}

/// One server-sent event from `POST /api/coach/messages` or `GET /api/coach/threads/:id/stream`.
/// Tagged on `type`; a stream always ends with `done`.
enum CoachStreamEvent: Decodable, Sendable {
    case start(thread: CoachThreadSummary, message: CoachMessage, reply: CoachMessage)
    /// What the coach is doing while there's no text yet or between steps, e.g. "Reading the prep guide".
    case status(String)
    case delta(String)
    /// A change proposed mid-reply; it also arrives in `done`.
    case action(CoachAction)
    /// The finished reply (`status` done or failed).
    case done(CoachMessage)
    /// An event this build doesn't know; ignored.
    case unknown

    private enum CodingKeys: String, CodingKey { case type, thread, message, reply, text, action }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .type) {
        case "start":
            self = .start(
                thread: try c.decode(CoachThreadSummary.self, forKey: .thread),
                message: try c.decode(CoachMessage.self, forKey: .message),
                reply: try c.decode(CoachMessage.self, forKey: .reply)
            )
        case "status": self = .status(try c.decode(String.self, forKey: .text))
        case "delta": self = .delta(try c.decode(String.self, forKey: .text))
        case "action": self = .action(try c.decode(CoachAction.self, forKey: .action))
        case "done": self = .done(try c.decode(CoachMessage.self, forKey: .reply))
        default: self = .unknown
        }
    }
}
