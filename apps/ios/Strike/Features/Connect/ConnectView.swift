import SwiftUI

/// Server address and access token. Tests `/api/health` then `/api/state` before saving.
struct ConnectView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    /// When presented from Settings, the screen dismisses itself after connecting.
    var isModal = false

    @State private var url = ""
    @State private var token = ""
    @State private var revealToken = false
    @State private var connecting = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case url, token }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    fields
                    if let message = error ?? app.connectMessage {
                        Label(message, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                    connectButton
                }
                .padding(.horizontal, 24)
                .padding(.top, isModal ? 8 : 48)
                .padding(.bottom, 32)
                .animation(Theme.spring, value: error)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(.systemGroupedBackground))
            .toolbar {
                if isModal {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", systemImage: "xmark") { dismiss() }
                    }
                }
            }
        }
        .onAppear {
            url = app.serverURL.isEmpty ? AppModel.defaultServerURL : app.serverURL
            token = app.token
        }
        .sensoryFeedback(.error, trigger: error) { _, new in new != nil }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            StrikeMark(size: 56)
            VStack(alignment: .leading, spacing: 6) {
                Text("Connect to Strike")
                    .font(.largeTitle.weight(.bold))
                Text("Your server runs on your tailnet. Make sure Tailscale is on.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var fields: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Server")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField("http://host:3090", text: $url)
                    .textContentType(.URL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focus, equals: .url)
                    .submitLabel(.next)
                    .onSubmit { focus = .token }
            }
            .padding(16)

            Divider().padding(.leading, 16)

            VStack(alignment: .leading, spacing: 6) {
                Text("Access token")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                HStack {
                    Group {
                        if revealToken {
                            TextField("Leave empty for a local dev server", text: $token)
                        } else {
                            SecureField("Leave empty for a local dev server", text: $token)
                        }
                    }
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focus, equals: .token)
                    .submitLabel(.go)
                    .onSubmit { Task { await connect() } }

                    Button {
                        revealToken.toggle()
                    } label: {
                        Image(systemName: revealToken ? "eye.slash" : "eye")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(revealToken ? "Hide token" : "Show token")
                }
            }
            .padding(16)
        }
        .background(Theme.cardBackground, in: .rect(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var connectButton: some View {
        Button {
            Task { await connect() }
        } label: {
            HStack {
                if connecting {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Connect")
                }
            }
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 34)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
        .disabled(connecting || url.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    private func connect() async {
        focus = nil
        connecting = true
        error = nil
        defer { connecting = false }
        do {
            try await app.connect(url: url, token: token)
            if isModal { dismiss() }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
