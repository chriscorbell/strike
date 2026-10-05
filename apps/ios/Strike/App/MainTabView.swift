import SwiftUI

enum AppTab: Hashable {
    case today, meals, coach, progress, plan
}

struct MainTabView: View {
    @Environment(AppModel.self) private var app

    /// The screen stays on while a workout is open or in progress, even when minimized.
    private var keepAwake: Bool {
        if app.isCooking { return true }
        guard let workout = app.activeWorkout else { return false }
        return !workout.isFinished && (app.isWorkoutPresented || workout.session?.status == .inProgress)
    }

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.selectedTab) {
            Tab("Today", systemImage: "sun.max.fill", value: AppTab.today) {
                TodayView()
            }
            Tab("Meals", systemImage: "fork.knife", value: AppTab.meals) {
                MealsView()
            }
            Tab("Coach", systemImage: "bubble.left.and.text.bubble.right.fill", value: AppTab.coach) {
                CoachView()
            }
            Tab("Progress", systemImage: "chart.line.uptrend.xyaxis", value: AppTab.progress) {
                BodyProgressView()
            }
            Tab("Plan", systemImage: "calendar", value: AppTab.plan) {
                PlanView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sensoryFeedback(.warning, trigger: app.cookTimers.finishedTick)
        .onChange(of: keepAwake, initial: true) { _, awake in
            UIApplication.shared.isIdleTimerDisabled = awake
        }
        .modifier(WorkoutAccessory(active: app.activeWorkout != nil && !app.isWorkoutPresented))
        .fullScreenCover(isPresented: $app.isWorkoutPresented) {
            if let store = app.activeWorkout {
                WorkoutView(store: store)
                    .environment(app)
            }
        }
        .sheet(isPresented: $app.isSettingsPresented) {
            SettingsView()
        }
    }
}

/// Shows the workout in progress above the tab bar while its full-screen view is minimized.
private struct WorkoutAccessory: ViewModifier {
    var active: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26.1, *) {
            content.tabViewBottomAccessory(isEnabled: active) {
                WorkoutMiniBar()
            }
        } else if active {
            content.tabViewBottomAccessory {
                WorkoutMiniBar()
            }
        } else {
            content
        }
    }
}

// MARK: - Settings entry point

/// Toolbar button that opens Settings; each tab's root puts it in its toolbar.
struct SettingsToolbarButton: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            app.isSettingsPresented = true
        } label: {
            Image(systemName: "person.crop.circle")
        }
        .accessibilityLabel("Settings")
    }
}
