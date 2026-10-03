import SwiftUI

/// First-run onboarding (a step-by-step flow ending in Review) and the profile editor reached from
/// Settings (a list of the same screens, each of which can be saved).
struct OnboardingFlow: View {
    enum Mode: Equatable { case initial, edit }

    var mode: Mode

    @Environment(AppModel.self) private var app

    var body: some View {
        OnboardingFlowRoot(mode: mode, profile: app.profile)
    }
}

private struct OnboardingFlowRoot: View {
    @State private var model: OnboardingModel

    init(mode: OnboardingFlow.Mode, profile: Profile?) {
        _model = State(initialValue: OnboardingModel(mode: mode, profile: profile))
    }

    var body: some View {
        switch model.mode {
        case .initial:
            OnboardingWizard(model: model)
        case .edit:
            OnboardingProfileEditor(model: model)
        }
    }
}

// MARK: - First run

private struct OnboardingWizard: View {
    @Bindable var model: OnboardingModel

    var body: some View {
        NavigationStack(path: $model.path) {
            OnboardingStepScreen(model: model, route: OnboardingRoute(step: .about))
                .navigationDestination(for: OnboardingRoute.self) { route in
                    OnboardingStepScreen(model: model, route: route)
                }
        }
    }
}

// MARK: - Editing from Settings

private struct OnboardingProfileEditor: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Bindable var model: OnboardingModel
    @State private var confirmDiscard = false

    var body: some View {
        NavigationStack(path: $model.path) {
            Form {
                Section {
                    ForEach(model.steps) { step in
                        NavigationLink(value: OnboardingRoute(step: step)) {
                            sectionRow(step)
                        }
                    }
                }

                if model.hasChanges, !model.saveEffects.isEmpty {
                    Section("When you save") {
                        ForEach(model.saveEffects) { effect in
                            Label(effect.text, systemImage: effect.symbol)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .transition(.opacity)
                }
            }
            .animation(Theme.spring, value: model.saveEffects.map(\.rawValue))
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") {
                        if model.hasChanges {
                            confirmDiscard = true
                        } else {
                            dismiss()
                        }
                    }
                    .confirmationDialog("Discard your changes?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                        Button("Discard changes", role: .destructive) { dismiss() }
                        Button("Keep editing", role: .cancel) {}
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    OnboardingSaveButton(model: model)
                }
            }
            .navigationDestination(for: OnboardingRoute.self) { route in
                OnboardingStepScreen(model: model, route: route)
            }
        }
        .interactiveDismissDisabled(model.hasChanges)
        .task { await model.loadLatestWeight(api: app.api) }
        .onChange(of: model.didSave) { _, saved in
            if saved { dismiss() }
        }
        .alert("Couldn't save", isPresented: saveErrorShown) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.submitError ?? "")
        }
        .sensoryFeedback(.error, trigger: model.submitError) { _, new in new != nil }
    }

    private func sectionRow(_ step: OnboardingStep) -> some View {
        let issue = model.issue(for: step)
        return Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                Text(issue ?? model.draft.summary(for: step))
                    .font(.subheadline)
                    .foregroundStyle(issue == nil ? Color.secondary : Theme.warning)
                    .lineLimit(2)
            }
            .padding(.vertical, 2)
        } icon: {
            Image(systemName: issue == nil ? step.symbol : "exclamationmark.triangle.fill")
                .foregroundStyle(issue == nil ? Color.accentColor : Theme.warning)
        }
    }

    private var saveErrorShown: Binding<Bool> {
        Binding {
            model.submitError != nil
        } set: { shown in
            if !shown { model.submitError = nil }
        }
    }
}

private struct OnboardingSaveButton: View {
    @Environment(AppModel.self) private var app
    var model: OnboardingModel

    var body: some View {
        if model.isSubmitting {
            ProgressView()
        } else {
            Button("Save", systemImage: "checkmark") {
                OnboardingKeyboard.dismiss()
                Task { await model.save(app: app) }
            }
            .disabled(!model.hasChanges || model.firstIssue != nil)
        }
    }
}

// MARK: - One screen

/// A single step: its form, plus the progress bar and Continue button during first-run onboarding
/// or a Save button while editing.
struct OnboardingStepScreen: View {
    @Environment(AppModel.self) private var app
    @Bindable var model: OnboardingModel
    var route: OnboardingRoute

    private var step: OnboardingStep { route.step }
    private var isWizard: Bool { model.mode == .initial }
    private var showsProgress: Bool { isWizard && !route.revisit }
    private var issue: String? { model.issue(for: step) }

    var body: some View {
        Form {
            if showsProgress {
                Section {
                    header
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 0, trailing: 4))
            }

            OnboardingStepContent(model: model, step: step)

            if !isWizard, let issue {
                Section {
                    Label(issue, systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Theme.warning)
                }
                .transition(.opacity)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(step.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .safeAreaBar(edge: .bottom) {
            if isWizard {
                bottomBar
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(step.title)
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)
            if step == .body {
                Text("Optional")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if showsProgress {
            ToolbarItem(placement: .principal) {
                OnboardingProgressBar(position: model.position(of: step), count: model.steps.count)
            }
            .sharedBackgroundVisibility(.hidden)
        }
        if !isWizard {
            ToolbarItem(placement: .confirmationAction) {
                OnboardingSaveButton(model: model)
            }
        }
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("Done") { OnboardingKeyboard.dismiss() }
                .fontWeight(.semibold)
        }
    }

    // MARK: Bottom bar

    private var bottomMessage: String? {
        if step == .review, let error = model.submitError { return error }
        return issue
    }

    private var bottomBar: some View {
        VStack(spacing: 10) {
            if let bottomMessage {
                Text(bottomMessage)
                    .font(.footnote)
                    .foregroundStyle(step == .review && model.submitError != nil ? Theme.warning : Color.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
            Button(action: primaryAction) {
                ZStack {
                    Text(primaryTitle)
                        .opacity(model.isSubmitting ? 0 : 1)
                    if model.isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 34)
                .contentTransition(.opacity)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(issue != nil || model.isSubmitting)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .animation(Theme.spring, value: bottomMessage)
        .animation(Theme.snappy, value: primaryTitle)
        .sensoryFeedback(.error, trigger: model.submitError) { _, new in new != nil }
    }

    private var primaryTitle: String {
        if route.revisit { return "Done" }
        switch step {
        case .review: return "Build my plan"
        case .body where model.draft.measurements.isEmpty: return "Skip"
        default: return "Continue"
        }
    }

    private func primaryAction() {
        OnboardingKeyboard.dismiss()
        if step == .review, !route.revisit {
            Task { await model.submit(app: app) }
        } else {
            model.advance(from: route)
        }
    }
}

/// Picks the form sections for a step.
private struct OnboardingStepContent: View {
    @Bindable var model: OnboardingModel
    var step: OnboardingStep

    var body: some View {
        switch step {
        case .about: OnboardingAboutStep(model: model)
        case .body: OnboardingBodyStep(model: model)
        case .goal: OnboardingGoalStep(model: model)
        case .day: OnboardingDayStep(model: model)
        case .training: OnboardingTrainingStep(model: model)
        case .equipment: OnboardingEquipmentStep(model: model)
        case .food: OnboardingFoodStep(model: model)
        case .review: OnboardingReviewStep(model: model)
        }
    }
}

/// Segments for "step x of n" in the navigation bar.
private struct OnboardingProgressBar: View {
    var position: Int
    var count: Int
    @State private var filled: Int

    init(position: Int, count: Int) {
        self.position = position
        self.count = count
        _filled = State(initialValue: max(position - 1, 0))
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(1 ... max(count, 1), id: \.self) { index in
                Capsule()
                    .fill(index <= filled ? Color.accentColor : Color(.tertiarySystemFill))
                    .frame(width: 18, height: 5)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(position) of \(count)")
        .onAppear {
            guard filled != position else { return }
            withAnimation(Theme.spring.delay(0.15)) { filled = position }
        }
    }
}
