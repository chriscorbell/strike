import Foundation
import Observation
import SwiftUI

/// A screen in the onboarding navigation stack. `revisit` marks a step opened from Review, whose
/// button returns to Review instead of moving on.
struct OnboardingRoute: Hashable, Sendable {
    var step: OnboardingStep
    var revisit = false
}

/// State for one run of the onboarding flow or the profile editor.
@MainActor
@Observable
final class OnboardingModel {
    let mode: OnboardingFlow.Mode
    var draft: OnboardingDraft
    /// The saved profile when editing, to detect changes.
    let original: Profile?
    var path: [OnboardingRoute] = []

    private(set) var isSubmitting = false
    var submitError: String?
    /// Set after a successful save so the editor can dismiss itself.
    private(set) var didSave = false
    /// The latest weight trend, for showing what a weekly rate means while editing.
    var latestWeightKg: Double?

    /// Dumbbell setups the user switched away from, so switching back restores them.
    @ObservationIgnored var stashedDumbbells: [Location: [OnboardingDumbbellKind: DumbbellSet]] = [:]

    init(mode: OnboardingFlow.Mode, profile: Profile?) {
        self.mode = mode
        if mode == .edit, let profile {
            draft = OnboardingDraft(editing: profile)
            original = profile
        } else {
            draft = .initial()
            original = nil
        }
    }

    var steps: [OnboardingStep] { OnboardingStep.steps(for: mode) }
    var units: UnitSystem { draft.units }

    /// Body weight to explain a weekly rate with: the entered weight, or the trend when editing.
    var referenceWeightKg: Double? { draft.weightKg ?? latestWeightKg }

    func issue(for step: OnboardingStep) -> String? {
        draft.issue(for: step, mode: mode)
    }

    var firstIssue: String? {
        steps.lazy.compactMap { self.issue(for: $0) }.first
    }

    var hasChanges: Bool {
        guard let original else { return true }
        return draft.normalizedProfile != original
    }

    var saveEffects: [OnboardingSaveEffect] {
        guard let original else { return [] }
        return draft.saveEffects(comparedTo: original)
    }

    // MARK: Navigation

    func next(after step: OnboardingStep) -> OnboardingStep? {
        guard let index = steps.firstIndex(of: step), index + 1 < steps.count else { return nil }
        return steps[index + 1]
    }

    func position(of step: OnboardingStep) -> Int {
        (steps.firstIndex(of: step) ?? 0) + 1
    }

    func advance(from route: OnboardingRoute) {
        if route.revisit {
            if !path.isEmpty { path.removeLast() }
        } else if let next = next(after: route.step) {
            path.append(OnboardingRoute(step: next))
        }
    }

    func revisit(_ step: OnboardingStep) {
        path.append(OnboardingRoute(step: step, revisit: true))
    }

    // MARK: Equipment

    func setDumbbellKind(_ kind: OnboardingDumbbellKind, at location: Location) {
        let current = draft.profile.equipment[location].dumbbells
        let currentKind = OnboardingDumbbellKind(current)
        guard kind != currentKind else { return }
        stashedDumbbells[location, default: [:]][currentKind] = current
        // The defaults have adjustable dumbbells at home and a fixed rack at the gym.
        let defaults = OnboardingDraft.defaultEquipment(for: draft.loadUnit)
        let replacement: DumbbellSet = switch kind {
        case .none: .none
        case .adjustable: stashedDumbbells[location]?[kind] ?? defaults.home.dumbbells
        case .fixed: stashedDumbbells[location]?[kind] ?? defaults.gym.dumbbells
        }
        draft.profile.equipment[location].dumbbells = replacement
    }

    func setUnits(_ units: Units) {
        guard units != draft.profile.units else { return }
        let from = draft.loadUnit
        draft.setUnits(units)
        let to = draft.loadUnit
        // Stashed setups follow the new unit too.
        for (location, stash) in stashedDumbbells {
            stashedDumbbells[location] = stash.mapValues { OnboardingDraft.convert($0, from: from, to: to) }
        }
    }

    // MARK: Server

    /// `POST /api/onboarding`; the app moves on to plan building when it succeeds.
    func submit(app: AppModel) async {
        guard !isSubmitting else { return }
        if let issue = issue(for: .review) {
            submitError = issue
            return
        }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }
        do {
            try await app.submitOnboarding(draft.onboardingRequest)
        } catch is CancellationError {
        } catch {
            submitError = error.localizedDescription
        }
    }

    /// `PUT /api/profile`.
    func save(app: AppModel) async {
        guard !isSubmitting else { return }
        if let issue = firstIssue {
            submitError = issue
            return
        }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }
        do {
            try await app.saveProfile(draft.normalizedProfile)
            didSave = true
        } catch is CancellationError {
        } catch {
            submitError = error.localizedDescription
        }
    }

    /// Loads the weight trend so the goal screen can say what a rate means in pounds or kilos.
    func loadLatestWeight(api: APIClient?) async {
        guard mode == .edit, latestWeightKg == nil, let api else { return }
        if let response: WeightsResponse = try? await api.get("/api/weights", query: ["days": "60"]) {
            latestWeightKg = response.latestTrendKg ?? response.points.last(where: { $0.weightKg != nil })?.weightKg
        }
    }
}

/// The three shapes a dumbbell setup can take, for the segmented picker.
enum OnboardingDumbbellKind: String, CaseIterable, Identifiable, Sendable {
    case none
    case adjustable
    case fixed

    var id: String { rawValue }

    init(_ set: DumbbellSet) {
        switch set {
        case .none: self = .none
        case .adjustable: self = .adjustable
        case .fixed: self = .fixed
        }
    }

    var title: String {
        switch self {
        case .none: "None"
        case .adjustable: "Adjustable"
        case .fixed: "Fixed set"
        }
    }
}
