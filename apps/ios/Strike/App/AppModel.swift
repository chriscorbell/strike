import Foundation
import Observation
import SwiftUI

/// App-wide state: the server connection, the user's profile and targets, preferences, and the
/// feature stores. Lives on the main actor; views read it from the environment.
@MainActor
@Observable
final class AppModel {
    enum Phase: Equatable {
        case launching
        case connect
        case unreachable(String)
        case onboarding
        /// Onboarding just finished and the coach is writing the first plan.
        case building
        case ready
    }

    enum Appearance: String, CaseIterable, Identifiable {
        case dark
        case system
        case light

        var id: String { rawValue }
        var displayName: String { rawValue.capitalized }
        var colorScheme: ColorScheme? {
            switch self {
            case .dark: .dark
            case .light: .light
            case .system: nil
            }
        }
    }

    static let defaultServerURL = "http://minicore.tail047de3.ts.net:3090"

    private(set) var phase: Phase = .launching
    private(set) var serverURL: String
    private(set) var token: String
    private(set) var api: APIClient?
    private(set) var state: StateResponse?
    private(set) var health: HealthResponse?
    /// Shown on the Connect screen, e.g. after the server rejects the token.
    var connectMessage: String?
    var toast: Toast?

    var appearance: Appearance {
        didSet { defaults.set(appearance.rawValue, forKey: Keys.appearance) }
    }

    var healthSyncEnabled: Bool {
        didSet { defaults.set(healthSyncEnabled, forKey: Keys.health) }
    }

    var notificationsEnabled: Bool {
        didSet { defaults.set(notificationsEnabled, forKey: Keys.notifications) }
    }

    // Workout in progress, presented full screen and reachable from the tab bar accessory.
    var activeWorkout: WorkoutStore?
    var isWorkoutPresented = false
    var isSettingsPresented = false
    var selectedTab: AppTab = .today
    /// Where the Meals tab should open next, e.g. next week's groceries from Today's card.
    var mealsFocus: MealsFocus?
    /// Bumped whenever coach jobs finish, so screens showing coach output can reload.
    private(set) var coachJobsTick = 0

    // Feature stores.
    let today = TodayStore()
    let meals = MealsStore()
    let progress = ProgressStore()
    let plan = PlanStore()
    let healthKit = HealthKitService()
    let notifications = NotificationService()

    @ObservationIgnored private let defaults = UserDefaults.standard

    private enum Keys {
        static let serverURL = "serverURL"
        static let token = "apiToken"
        static let appearance = "appearance"
        static let health = "healthSyncEnabled"
        static let notifications = "notificationsEnabled"
    }

    init() {
        serverURL = defaults.string(forKey: Keys.serverURL) ?? ""
        token = Keychain.read(Keys.token) ?? ""
        appearance = Appearance(rawValue: defaults.string(forKey: Keys.appearance) ?? "") ?? .dark
        healthSyncEnabled = defaults.bool(forKey: Keys.health)
        notificationsEnabled = defaults.object(forKey: Keys.notifications) as? Bool ?? true
        for store in [today, meals, progress, plan] as [any AppStore] {
            store.app = self
        }
        notifications.app = self
    }

    // MARK: Derived

    var profile: Profile? { state?.profile }
    var units: UnitSystem { UnitSystem(units: profile?.units ?? .imperial) }
    var loadUnit: LoadUnit { units.loadUnit }
    var coachAvailable: Bool { state?.coachAvailable ?? false }
    var isConfigured: Bool { !serverURL.isEmpty }

    // MARK: Connection

    func launch() async {
        guard isConfigured, let client = makeClient(url: serverURL, token: token) else {
            phase = .connect
            return
        }
        api = client
        await loadState()
    }

    /// Tests the server (`/api/health`, then `/api/state`) and saves the connection when both work.
    func connect(url rawURL: String, token rawToken: String) async throws {
        let url = Self.normalize(rawURL)
        let token = rawToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let client = makeClient(url: url, token: token, reportUnauthorized: false) else { throw APIError.invalidURL }
        let health: HealthResponse = try await client.get("/api/health")
        let state: StateResponse = try await client.get("/api/state")

        serverURL = url
        self.token = token
        defaults.set(url, forKey: Keys.serverURL)
        Keychain.write(token, for: Keys.token)
        api = makeClient(url: url, token: token)
        self.health = health
        connectMessage = nil
        apply(state)
    }

    func disconnect() {
        Keychain.write(nil, for: Keys.token)
        token = ""
        api = nil
        state = nil
        activeWorkout = nil
        isWorkoutPresented = false
        phase = .connect
    }

    func loadState() async {
        guard let api else {
            phase = .connect
            return
        }
        do {
            let state: StateResponse = try await api.get("/api/state")
            apply(state)
            health = try? await api.get("/api/health")
        } catch APIError.unauthorized {
            // handled by the client callback
        } catch is CancellationError {
        } catch {
            if state == nil {
                phase = .unreachable(error.localizedDescription)
            } else {
                report(error)
            }
        }
    }

    func refreshState() async {
        guard let api else { return }
        if let state: StateResponse = try? await api.get("/api/state") {
            self.state = state
        }
    }

    /// Adopts a fresh state from the server (e.g. after onboarding or a profile edit).
    func apply(_ state: StateResponse) {
        self.state = state
        switch phase {
        case .building:
            break
        default:
            phase = state.onboarded ? .ready : .onboarding
        }
    }

    /// `POST /api/onboarding`; afterwards the app shows the coach building the first plan.
    func submitOnboarding(_ request: OnboardingRequest) async throws {
        guard let api else { throw APIError.transport("Not connected to a server.") }
        let state: StateResponse = try await api.post("/api/onboarding", request)
        self.state = state
        withAnimation(Theme.spring) { phase = .building }
    }

    /// `PUT /api/profile`; targets are recomputed server-side.
    func saveProfile(_ profile: Profile) async throws {
        guard let api else { throw APIError.transport("Not connected to a server.") }
        let state: StateResponse = try await api.put("/api/profile", profile)
        self.state = state
        await today.load()
    }

    func finishBuilding() {
        withAnimation(Theme.spring) { phase = .ready }
    }

    private func handleUnauthorized() {
        guard phase != .connect else { return }
        connectMessage = "The server rejected the access token. Check it and connect again."
        api = nil
        activeWorkout = nil
        isWorkoutPresented = false
        phase = .connect
    }

    private func makeClient(url: String, token: String, reportUnauthorized: Bool = true) -> APIClient? {
        guard let base = URL(string: Self.normalize(url)), base.scheme?.hasPrefix("http") == true, base.host() != nil else {
            return nil
        }
        return APIClient(baseURL: base, token: token) { [weak self] in
            guard reportUnauthorized else { return }
            Task { @MainActor in self?.handleUnauthorized() }
        }
    }

    static func normalize(_ raw: String) -> String {
        var url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !url.isEmpty, !url.contains("://") { url = "http://" + url }
        while url.hasSuffix("/") { url.removeLast() }
        return url
    }

    // MARK: Errors

    /// Shows a transient error toast. Cancellations and 401s (handled elsewhere) are ignored.
    func report(_ error: Error) {
        if error is CancellationError { return }
        if case APIError.unauthorized = error { return }
        if let urlError = error as? URLError, urlError.code == .cancelled { return }
        show(Toast(message: error.localizedDescription, style: .error))
    }

    func show(_ toast: Toast) {
        withAnimation(Theme.spring) { self.toast = toast }
    }

    // MARK: Workout

    func openWorkout(sessionId: Int) async {
        if let active = activeWorkout, active.sessionId == sessionId {
            isWorkoutPresented = true
            return
        }
        let store = WorkoutStore(sessionId: sessionId, app: self)
        activeWorkout = store
        isWorkoutPresented = true
        await store.load()
    }

    func closeWorkout() {
        isWorkoutPresented = false
        activeWorkout = nil
    }

    /// Switches to Meals on a given week and section.
    func showMeals(week: MenuWeek, section: MealsSection) {
        mealsFocus = MealsFocus(week: week, section: section)
        selectedTab = .meals
    }

    func coachJobsChanged() {
        coachJobsTick += 1
    }

    // MARK: Lifecycle

    /// Foreground refresh: today, Apple Health sync and notifications.
    func didBecomeActive() async {
        guard phase == .ready, api != nil else { return }
        if healthSyncEnabled { await syncHealth() }
        await today.load()
    }

    func syncHealth() async {
        guard healthSyncEnabled, let api else { return }
        do {
            let imported = try await healthKit.syncBodyMass(api: api)
            if imported > 0 {
                await today.load()
            }
        } catch {
            // Denied or unavailable: stay quiet; Settings explains the state.
        }
    }
}

struct Toast: Equatable, Identifiable {
    enum Style { case error, info, success }

    let id = UUID()
    var message: String
    var style: Style = .info
}

/// A feature store that reaches the API through the app model.
@MainActor
protocol AppStore: AnyObject {
    var app: AppModel? { get set }
}

extension AppStore {
    var api: APIClient {
        get throws {
            guard let api = app?.api else { throw APIError.transport("Not connected to a server.") }
            return api
        }
    }
}
