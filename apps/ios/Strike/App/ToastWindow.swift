import SwiftUI
import UIKit

/// Hosts toasts in their own pass-through window above everything, so errors stay visible over
/// sheets and the full-screen workout.
enum ToastWindow {
    @MainActor private static var window: UIWindow?

    @MainActor
    static func install(app: AppModel) {
        guard window == nil,
              let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
        else { return }
        let host = UIHostingController(rootView: ToastHost().environment(app))
        host.view.backgroundColor = .clear
        let overlay = PassthroughWindow(windowScene: scene)
        overlay.windowLevel = .alert + 1
        overlay.rootViewController = host
        overlay.backgroundColor = .clear
        overlay.isHidden = false
        window = overlay
    }
}

private struct ToastHost: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Color.clear
            .ignoresSafeArea()
            .overlay(alignment: .top) { ToastOverlay() }
            .preferredColorScheme(app.appearance.colorScheme)
            .allowsHitTesting(false)
    }
}

/// Lets touches through to the app's main window.
private final class PassthroughWindow: UIWindow {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        nil
    }
}
