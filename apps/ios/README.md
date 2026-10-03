# Strike for iOS

The native iPhone app for Strike: today's meals and workout, set logging in the gym, meal menus, progress and the training plan. It talks to the Strike server's HTTP API ([docs/api.md](../../docs/api.md)); the Swift models in `Strike/Models` mirror `packages/core`.

SwiftUI, iOS 26+, Swift 6 with strict concurrency, no third-party dependencies.

## Project

`project.yml` is the source of truth for `Strike.xcodeproj`. After changing it, regenerate:

```sh
brew install xcodegen   # once
cd apps/ios
xcodegen generate
```

Sources live in a synchronized folder, so new Swift files under `Strike/` need no regeneration.

## Build and run in the Simulator

```sh
cd apps/ios
xcodebuild -project Strike.xcodeproj -scheme Strike \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build
```

Or open `Strike.xcodeproj` in Xcode and run the Strike scheme on a simulator. A local dev server (`pnpm --filter @strike/server dev`) is reachable from the Simulator at `http://localhost:3090` with no token.

## Install on your iPhone

1. Open `Strike.xcodeproj` in Xcode and sign in to the team `M5MQ93V9V8` (Xcode → Settings → Accounts). Signing is automatic; Xcode creates the development certificate and enables HealthKit for `cc.xode.strike`.
2. Connect the iPhone, enable Developer Mode if asked (Settings → Privacy & Security), choose it as the run destination, and press ⌘R.

## Connect

On first launch, enter the server URL and access token:

- Server: `http://minicore.tail047de3.ts.net:3090`. Plain HTTP is only allowed for `*.ts.net` and local addresses, and the server is only reachable with Tailscale on.
- Token: the server's `STRIKE_TOKEN`. It's stored in the Keychain. If the server rejects it, the app returns to this screen.

Change either later in Settings (the person icon on each tab).

## Apple Health and notifications

- **Apple Health** (Settings → Apple Health): reads body mass and posts each day's first reading from the last 30 days on launch and when the app comes to the foreground; saves each finished session as a strength training workout.
- **Notifications**: permission is asked on the first Today load. Strike schedules reminders for today's and tomorrow's meals and workout, and a rest-timer alert when the app is in the background during a session.
