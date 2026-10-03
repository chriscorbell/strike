import SwiftUI

@main
struct StrikeApp: App {
    @State private var app = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(app.today)
                .environment(app.meals)
                .environment(app.progress)
                .environment(app.plan)
                .preferredColorScheme(app.appearance.colorScheme)
                .task { await app.launch() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await app.didBecomeActive() }
            }
        }
    }
}
