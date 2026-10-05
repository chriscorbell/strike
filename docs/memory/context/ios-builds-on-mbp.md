# Building and checking the iOS app on mbp

Read when: building, running or screenshotting `apps/ios` on Chris's Mac.
Status: verified
Scope: apps/ios, mbp
Verified: 2026-10-05
Source: `xcrun simctl list runtimes` (empty) and `xcrun devicectl list devices` on 2026-10-05
Recheck when: an iOS Simulator runtime is installed (`xcodebuild -downloadPlatform iOS`)

- No iOS Simulator runtime is installed, so the README's `-destination 'platform=iOS Simulator,name=…'` fails and nothing can be run or screenshotted in a simulator. Build with `-destination 'generic/platform=iOS'` (add `CODE_SIGNING_ALLOWED=NO` for a compile check). Installing a runtime is a multi-GB change outside the repo; ask Chris first.
- Chris's iPhone (iPhone 17 Pro) is paired with this Mac and shows as `available (paired)` in `xcrun devicectl list devices`, so a signed device build can be installed on it with `devicectl` (team `M5MQ93V9V8`, see `apps/ios/README.md`).
