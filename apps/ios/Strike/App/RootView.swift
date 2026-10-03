import SwiftUI

/// Switches between connecting, onboarding and the main app, and hosts the toast overlay.
struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ZStack {
            switch app.phase {
            case .launching:
                LaunchView()
                    .transition(.opacity)
            case .connect:
                ConnectView()
                    .transition(.opacity)
            case let .unreachable(message):
                UnreachableView(message: message)
                    .transition(.opacity)
            case .onboarding:
                OnboardingFlow(mode: .initial)
                    .transition(.opacity)
            case .building:
                PlanBuildingView()
                    .transition(.opacity)
            case .ready:
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(Theme.spring, value: app.phase)
        .onAppear { ToastWindow.install(app: app) }
    }
}

private struct LaunchView: View {
    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            StrikeMark(size: 64)
        }
    }
}

/// The app's mark: a bolt in the accent color.
struct StrikeMark: View {
    var size: CGFloat = 44

    var body: some View {
        Image(systemName: "bolt.fill")
            .font(.system(size: size * 0.55, weight: .black))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color.accentColor, in: .rect(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}

private struct UnreachableView: View {
    @Environment(AppModel.self) private var app
    var message: String
    @State private var retrying = false

    var body: some View {
        ContentUnavailableView {
            Label("Can't reach Strike", systemImage: "network.slash")
        } description: {
            Text(message)
        } actions: {
            VStack(spacing: 12) {
                Button {
                    retrying = true
                    Task {
                        await app.launch()
                        retrying = false
                    }
                } label: {
                    if retrying {
                        ProgressView()
                    } else {
                        Text("Try again")
                    }
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(retrying)

                Button("Change server") {
                    app.disconnect()
                }
                .buttonStyle(.glass)
            }
        }
    }
}

struct ToastOverlay: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        if let toast = app.toast {
            HStack(spacing: 10) {
                Image(systemName: icon(toast.style))
                    .foregroundStyle(color(toast.style))
                Text(toast.message)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .glassEffect(.regular, in: .capsule)
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .task(id: toast.id) {
                try? await Task.sleep(for: .seconds(toast.style == .error ? 4 : 2.5))
                withAnimation(Theme.spring) {
                    if app.toast?.id == toast.id { app.toast = nil }
                }
            }
            .accessibilityAddTraits(.updatesFrequently)
            .sensoryFeedback(toast.style == .error ? .error : .success, trigger: toast.id)
        }
    }

    private func icon(_ style: Toast.Style) -> String {
        switch style {
        case .error: "exclamationmark.triangle.fill"
        case .info: "info.circle.fill"
        case .success: "checkmark.circle.fill"
        }
    }

    private func color(_ style: Toast.Style) -> Color {
        switch style {
        case .error: .orange
        case .info: .accentColor
        case .success: .green
        }
    }
}
