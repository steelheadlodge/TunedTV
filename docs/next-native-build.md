# Next native build (iOS + Android, 1.0.20)

One store review cycle per platform. Web changes keep shipping without a build; this list is
only what needs the native shell. Do not upload to Apple from an agent: Andrew submits.

**Keep this list current (Andrew, 2026-11-10):** anything found that needs the iOS or Android
shell goes here the same day, under iOS, Android or both. Web work that turned out *not* to need
a build goes under "Checked: no build needed", so nobody waits on a build for it.

Order: Apple approves 1.0.19, Google approves Android 1.0.19 (first Android TV release), then
these go into 1.0.20 on both.

## Already in the tree

- **Mirroring, Android** (0888d44): the TV page draws on the display Android gives apps while
  mirroring (Smart View, Miracast to Samsung, LG, Roku, Fire TV). Same `airplay` cap as iOS
  AirPlay. Built as EAS a18ed2be; rebuild if anything below lands first.
- **Android TV / Google TV app** (2a703e2): opens TunedTV's TV page full screen.
- **iOS keyboard** (51ae3fd): the web remote raises the keyboard when the TV's keyboard opens.
- After Google approves: flip `TV_APP_ON_PLAY=true` in tuned-tv-finder `ShowOnTvButton.tsx`.

## Still to add (found, not in the tree yet)

- **iOS multicast entitlement** (`com.apple.developer.networking.multicast`): needed for the /24
  Wake-on-LAN broadcast (unicast already works). Request it from Apple first (form, not instant),
  then turn the capability on for the bundle ID before the build. Any new entitlement needs its
  capability on first (see tuned-tv-finder AGENTS.md, build 34).

## Checked: no build needed

- **Apple TV remote** (tuned-tv-finder `fff3066`, 2026-11-10): pairing, keys, app list, title
  links, all web-side over the `net` cap. `_companion-link._tcp` has been in `NSBonjourServices`
  since 1.0.15, and Android mDNS takes any type. Ships by flipping `tested` in
  `src/lib/tv/drivers/appletv.ts` once tried from a phone on 1.0.15+.
- **Samsung TunedTV TV app** (`samsung/` in tuned-tv-finder): a TV app, not the phone shell. Goes
  through Samsung Seller Office (Andrew submits), separate from this build.

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
LG SSAP, Samsung, Android TV remote, Fios box, Apple TV) has to be callable from Swift or through an App
Group handoff to the app. Decide in the build: (a) small native sender per brand in the
extension, or (b) intent opens the app in the background (`openAppWhenRun = false` +
`ForegroundContinuableIntent` fallback). Measure the press-to-TV delay on the living room LG +
Fios box before choosing. Apple TV leans to (b): its Companion protocol is encrypted
(SRP pairing, ChaCha20) and the pairing keys live in the web's localStorage, so a native sender
would need its own crypto plus the keys shared through the App Group.

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
- Test on hardware before submit: living room LG + Fios box + Apple TV (LG HDMI1), bedroom
  Samsung + Fios box, garage Roku. Press each button from the Lock Screen / Dynamic Island / bubble with TunedTV closed.

## Dedicated remote mode (agreed 2026-11-09)

A phone or tablet that is only a TV remote (an old iPhone, an iPad on the couch, a spare Android
phone). The web already has Profile → TV Remote → **Remote mode** (opens straight to the main
TV's remote, web Wake Lock on iOS 18.4+). The build makes it a real dedicated device:

- **Opens to the remote, every time**: cold start, return from background, after a reboot. No
  Sports/Movies tabs; one small Settings corner (held 2 s) to leave the mode.
- **Screen stays usable**: `expo-keep-awake` while on; after a few idle minutes it dims to a
  near-black remote (OLED-friendly) and wakes full bright on touch or pickup. Plugged in: never
  sleeps. On battery: lets the device sleep after a longer idle so it isn't dead by morning.
- **Always connected**: reconnects to the TV and box as soon as it wakes; shows the TV's state
  (on, input, what's on) without a tap.
- **Locked to the remote**:
  - iOS: Guided Access can't be turned on by an app, so the mode walks the owner through it
    once (Settings → Accessibility → Guided Access, triple-click to start). Orientation lock.
  - Android: screen pinning (`startLockTask`) after one confirm; optional "Use TunedTV as the
    Home app" so the device boots into the remote. Device-owner kiosk stays out of scope.
- **Bigger pad**: the full remote at device size (iPad gets two columns: pad + apps/channels),
  haptics on every press, volume rocker on the side controls TV volume (Android
  `dispatchKeyEvent`; iOS can't take the hardware volume buttons, so the on-screen VOL stays).
- **No account needed on the remote device**: pair it from the main phone (show a code or QR
  on the main phone; the remote device copies its TVs and boxes). Signed-out mode keeps working.
- **Shared with the outside-the-app work**: the native TV senders built for the Live Activity /
  bubble are what make keys instant here too.

Test on hardware: a spare iPhone and an iPad as the living room remote for a full evening
(LG + Fios box): battery drain, dim/wake, reconnect after the TV sleeps, Guided Access exit.

## Remote left open for channel surfing (agreed 2026-11-09)

Any phone, not only a dedicated remote. Today (web): Remote mode holds the screen awake with the
Screen Wake Lock (iOS 18.4+); without it the phone sleeps on its own Auto-Lock.

Native build (`expo-keep-awake` + `expo-brightness`), on when Remote mode is on:

- **Awake only while it's useful**: held while the remote is on screen and the TV is on. Let go
  when the TV turns off, the app goes to the background, or after 20 min with no press (the
  phone's own Auto-Lock takes over from there).
- **Dim between presses**: after 45 s with no press the screen drops to ~10% brightness and the
  remote turns near-black (OLED pixels off); the first touch only wakes it (no key sent) and
  restores the brightness the person had. Never brighter than they set it.
- **Quiet while dim**: TV state polling (LG power every 30 s, now-playing) pauses while dimmed
  and resumes on wake; the TV connection stays open so the first key is instant.
- **Low Power Mode / Battery Saver**: dim after 20 s and let go after 10 min.
- **Plugged in**: no dim timeout and no let-go (charging dock use).
- Settings under Remote mode: "Dim after" (20 s / 45 s / 2 min / never) and "Stay awake for"
  (10 / 20 / 60 min / while TV is on).

Measure before submit: battery used per hour with the remote open on the living room LG + Fios
box, dim on vs off, iPhone and Android.

## Also waiting on a build

- `expo-keep-awake` (now part of Dedicated remote mode above).
