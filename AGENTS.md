# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

---

# TunedTV (native shell) — agent memory

This is the **thin Expo/React Native shell** for TunedTV. It loads the real UI — the web app
at `steelheadlodge/tuned-tv-finder` (published via Lovable to tunedtv.com) — inside a
**WebView**. Day-to-day UI/content changes happen in that web repo, NOT here. Touch this repo
only for native plugins, native config, or a new store build.

- Expo account (owner): `spcecwby`
- Bundle ID: `com.tunedtv.app`
- EAS project ID: `dc41ee5b-266b-4f94-9c02-cd1c6c7b79ee`
- OTA: **EAS Update**. Native plugins include `expo-apple-authentication`,
  `@react-native-google-signin/google-signin`, and `./plugins/withModularHeaders.js`.

## How to ship
- **Normal UI/content** → edit the web repo `tuned-tv-finder` and Publish in Lovable. Done.
- **Native change** → bump `version` in `app.json`, run an EAS build, then EAS Submit to the
  App Store / Play. Use the versioned Expo docs above.

Tracked in Dev HQ (`/Users/ai/Documents/GitHub/dev-hq`).
