# Next native build (iOS + Android, 1.0.20)

One store review cycle per platform. Web changes keep shipping without a build; this list is
only what needs the native shell. Do not upload to Apple from an agent: Andrew submits.

Order: Apple approves 1.0.19, Google approves Android 1.0.19 (first Android TV release), then
these go into 1.0.20 on both.

## Already in the tree

- **Mirroring, Android** (0888d44): the TV page draws on the display Android gives apps while
  mirroring (Smart View, Miracast to Samsung, LG, Roku, Fire TV). Same `airplay` cap as iOS
  AirPlay. Built as EAS a18ed2be; rebuild if anything below lands first.
- **Android TV / Google TV app** (2a703e2): opens TunedTV's TV page full screen.
- **iOS keyboard** (51ae3fd): the web remote raises the keyboard when the TV's keyboard opens.
- After Google approves: flip `TV_APP_ON_PLAY=true` in tuned-tv-finder `ShowOnTvButton.tsx`.

## Remote outside the app (agreed 2026-11-09)

Goal: the reduced remote bar (Last, CH up/down, VOL up/down, mute, what's on) reachable without
opening TunedTV. iOS has no overlay over other apps, so it uses Apple's surfaces; Android gets a
real floating bubble.

### iOS

1. **Live Activity** (ActivityKit + widget extension): starts when TunedTV first controls a TV
   in a session, on the Lock Screen and in the Dynamic Island. Shows the TV and what's on.
   Buttons are App Intents (iOS 17+, `LiveActivityIntent`): Last, CH up/down, VOL up/down, mute.
   Ends when the TV turns off or after Apple's 8 h limit; the next control starts a new one.
2. **Control Center controls** (iOS 18 `ControlWidget`): Last channel, Mute TV, Volume up/down.
   These can also go on the Lock Screen or the Action button.
3. **Home Screen widget** (interactive, iOS 17+): same buttons plus up to 3 favorite channels.

The intents run in the extension, not the web view: the TV control code they need (Roku ECP,
LG SSAP, Samsung, Android TV remote, Fios box) has to be callable from Swift or through an App
Group handoff to the app. Decide in the build: (a) small native sender per brand in the
extension, or (b) intent opens the app in the background (`openAppWhenRun = false` +
`ForegroundContinuableIntent` fallback). Measure the press-to-TV delay on the living room LG +
Fios box before choosing.

### Android

1. **Floating remote bubble** (`SYSTEM_ALERT_WINDOW`, asked once with a plain explanation):
   small round button over other apps; tap opens the reduced bar (Last, CH, VOL, mute). Drag to
   the edge to hide; drag to the X to stop.
2. **Ongoing notification** with Last, CH up/down, VOL up/down, mute while a TV is controlled
   (foreground service, `mediaPlayback` or `connectedDevice` type). Works with the bubble off.
3. **Home screen widget** with the same buttons.

Play policy: overlay permission must be justified in the listing and Data safety form; the
foreground service type needs the matching declaration.

### Shared

- The web remote tells the shell what's on and which TV is in use (existing `postNative`), so
  the Live Activity / notification shows it and knows where to send keys.
- Settings: Profile → TV Remote → "Remote outside the app" switch (on by default on iOS, asks
  for the overlay permission on Android).
- Test on hardware before submit: living room LG + Fios box, bedroom Samsung + Fios box, garage
  Roku. Press each button from the Lock Screen / Dynamic Island / bubble with TunedTV closed.

## Also waiting on a build

- `expo-keep-awake` for Remote mode (web Wake Lock covers iOS 18.4+ only).
