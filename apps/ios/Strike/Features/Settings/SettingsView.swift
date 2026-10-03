import SwiftUI
import UserNotifications

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var showConnect = false
    @State private var showEditProfile = false
    @State private var notificationStatus: UNAuthorizationStatus = .notDetermined
    @State private var savingUnits = false
    @State private var healthMessage: String?
    @State private var confirmDisconnect = false
    @State private var pendingUnits: Units?

    var body: some View {
        @Bindable var app = app
        NavigationStack {
            Form {
                if let profile = app.profile {
                    Section {
                        Button {
                            showEditProfile = true
                        } label: {
                            HStack(spacing: 14) {
                                Text(String(profile.name.prefix(1)).uppercased())
                                    .font(.title2.weight(.semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 52, height: 52)
                                    .background(Color.accentColor, in: .circle)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(profile.name)
                                        .font(.headline)
                                        .foregroundStyle(Color.primary)
                                    Text("\(profile.goal.type.displayName) · \(profile.training.days.count) days a week")
                                        .font(.subheadline)
                                        .foregroundStyle(Color.secondary)
                                }
                                Spacer()
                                Text("Edit")
                                    .foregroundStyle(.tint)
                            }
                        }
                        .accessibilityLabel("Edit profile, \(profile.name)")
                    }

                    Section {
                        Picker("Units", selection: unitsBinding(profile)) {
                            Text("Imperial (lb, in)").tag(Units.imperial)
                            Text("Metric (kg, cm)").tag(Units.metric)
                        }
                        .disabled(savingUnits)
                    } footer: {
                        Text("Body weight, measurements and training loads.")
                    }
                }

                Section {
                    Toggle(isOn: healthBinding) {
                        Label("Apple Health", systemImage: "heart.fill")
                    }
                    .disabled(!app.healthKit.isAvailable)
                } footer: {
                    Text(healthFooter)
                }

                Section {
                    Toggle(isOn: notificationsBinding) {
                        Label("Meal and workout reminders", systemImage: "bell.badge.fill")
                    }
                    if notificationStatus == .denied {
                        Button("Allow in iOS Settings") {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                        }
                    }
                } footer: {
                    Text(notificationStatus == .denied
                        ? "Notifications are turned off for Strike in iOS Settings."
                        : "Reminders at each meal time and before your workout, plus a rest timer alert when Strike is in the background.")
                }

                Section("Appearance") {
                    Picker("Appearance", selection: $app.appearance) {
                        ForEach(AppModel.Appearance.allCases) { appearance in
                            Text(appearance.displayName).tag(appearance)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section("Server") {
                    ValueRow(label: "Address", value: app.serverURL)
                    if let health = app.health {
                        ValueRow(label: "Version", value: health.version)
                        ValueRow(label: "Coach", value: health.coach.configured ? "Claude" : "Not configured")
                    }
                    Button("Change server or token") { showConnect = true }
                    Button("Disconnect", role: .destructive) { confirmDisconnect = true }
                }

                Section {
                } footer: {
                    Text("Strike \(Bundle.main.appVersion)")
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                }
            }
            .task { notificationStatus = await app.notifications.authorizationStatus() }
            .sheet(isPresented: $showConnect) {
                ConnectView(isModal: true)
            }
            .fullScreenCover(isPresented: $showEditProfile) {
                OnboardingFlow(mode: .edit)
            }
            .confirmationDialog(
                pendingUnits == .metric ? "Switch to kilograms?" : "Switch to pounds?",
                isPresented: Binding(get: { pendingUnits != nil }, set: { if !$0 { pendingUnits = nil } }),
                titleVisibility: .visible,
                presenting: pendingUnits
            ) { units in
                Button(units == .metric ? "Use kg and cm" : "Use lb and in") { saveUnits(units) }
            } message: { units in
                Text("Your dumbbells and machine increments convert to \(units == .metric ? "kg" : "lb"), and future training loads use \(units == .metric ? "kg" : "lb").")
            }
            .confirmationDialog("Disconnect from this server?", isPresented: $confirmDisconnect, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive) {
                    dismiss()
                    app.disconnect()
                }
            } message: {
                Text("The access token is removed from this iPhone. Your data stays on the server.")
            }
        }
    }

    private var healthFooter: String {
        if !app.healthKit.isAvailable { return "Apple Health isn't available on this device." }
        if let healthMessage { return healthMessage }
        return "Reads your body weight from the last 30 days and saves finished sessions as strength training workouts."
    }

    private func unitsBinding(_ profile: Profile) -> Binding<Units> {
        Binding {
            profile.units
        } set: { units in
            guard units != profile.units else { return }
            pendingUnits = units
        }
    }

    /// Converts equipment loads with the profile editor's rules, then saves.
    private func saveUnits(_ units: Units) {
        guard let profile = app.profile else { return }
        var draft = OnboardingDraft(editing: profile)
        draft.setUnits(units)
        savingUnits = true
        Task {
            do {
                try await app.saveProfile(draft.profile)
            } catch {
                app.report(error)
            }
            savingUnits = false
        }
    }

    private var healthBinding: Binding<Bool> {
        Binding {
            app.healthSyncEnabled
        } set: { enabled in
            guard enabled else {
                app.healthSyncEnabled = false
                healthMessage = nil
                return
            }
            Task {
                do {
                    try await app.healthKit.requestAuthorization()
                    app.healthSyncEnabled = true
                    healthMessage = nil
                    await app.syncHealth()
                    await app.today.load()
                } catch {
                    app.healthSyncEnabled = false
                    healthMessage = "Strike couldn't get access to Apple Health: \(error.localizedDescription)"
                }
            }
        }
    }

    private var notificationsBinding: Binding<Bool> {
        Binding {
            app.notificationsEnabled && notificationStatus != .denied
        } set: { enabled in
            app.notificationsEnabled = enabled
            Task {
                if enabled {
                    await app.notifications.requestPermission()
                    notificationStatus = await app.notifications.authorizationStatus()
                    await app.today.load()
                } else {
                    await app.notifications.removePlanNotifications()
                }
            }
        }
    }
}

extension Bundle {
    var appVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
