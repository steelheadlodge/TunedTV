const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, withAndroidManifest, IOSConfig, AndroidConfig } = require('expo/config-plugins');

/**
 * "Ask TunedTV" from outside the app. Both open tunedtv://assistant, which the shell hands to the
 * web app's /assistant page (src/app/index.tsx); the web side does the lookup and the TV switch.
 *
 * iOS: an App Intent + App Shortcut, so "Hey Siri, ask TunedTV" works with no setup. Siri asks
 * "What should I put on?" (App Shortcut phrases can't carry free text) and the answer goes in `q`.
 * Android: a launcher shortcut (long-press the icon) that opens the page with the mic ready.
 */

const SWIFT = `import AppIntents
import UIKit

@available(iOS 16.0, *)
struct AskTunedTVIntent: AppIntent {
  static var title: LocalizedStringResource = "Ask TunedTV"
  static var description = IntentDescription("Put a game, channel, movie or show on your TV.")
  static var openAppWhenRun: Bool = true

  @Parameter(title: "What to watch", requestValueDialog: IntentDialog("What should I put on?"))
  var request: String

  @MainActor
  func perform() async throws -> some IntentResult {
    var c = URLComponents()
    c.scheme = "tunedtv"
    c.host = "assistant"
    c.queryItems = [URLQueryItem(name: "q", value: request)]
    if let url = c.url {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct TunedTVShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AskTunedTVIntent(),
      phrases: [
        "Ask \\(.applicationName)",
        "Ask \\(.applicationName) to put something on",
        "Put something on with \\(.applicationName)",
        "\\(.applicationName) put something on",
      ],
      shortTitle: "Ask TunedTV",
      systemImageName: "tv"
    )
  }
}
`;

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="ask"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/ask_tunedtv_short"
    android:shortcutLongLabel="@string/ask_tunedtv_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="com.tunedtv.app"
      android:data="tunedtv://assistant?mic=1" />
  </shortcut>
</shortcuts>
`;

const FILE = 'AskTunedTVIntent.swift';

function withIosIntent(config) {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      fs.writeFileSync(path.join(dir, FILE), SWIFT);
      return cfg;
    },
  ]);
  return withXcodeProject(config, (cfg) => {
    const name = cfg.modRequest.projectName;
    const filepath = `${name}/${FILE}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project: cfg.modResults });
    }
    return cfg;
  });
}

function withAndroidShortcut(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml/shortcuts.xml'), SHORTCUTS_XML);
      const values = path.join(res, 'values/ask_tunedtv.xml');
      fs.mkdirSync(path.dirname(values), { recursive: true });
      fs.writeFileSync(
        values,
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="ask_tunedtv_short">Ask TunedTV</string>\n  <string name="ask_tunedtv_long">Ask TunedTV to put something on</string>\n</resources>\n'
      );
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['meta-data'] = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    return cfg;
  });
}

module.exports = function withAskTunedTV(config) {
  return withAndroidShortcut(withIosIntent(config));
};
