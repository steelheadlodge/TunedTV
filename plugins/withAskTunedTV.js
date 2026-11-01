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

// One-sentence Siri phrases ("Put on the Knicks game with TunedTV") can only carry values from a
// fixed list (AppEnum), so each list below becomes one. [what Siri hears, what the web assistant
// is asked]. Shared nicknames use the city so Siri can't pick the wrong team; the web side also
// prefers the in-season team.
const TEAMS = [
  'Falcons', 'Ravens', 'Bills', 'Bears', 'Bengals', 'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers',
  'Texans', 'Colts', 'Jaguars', 'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots',
  'Saints', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers', 'Titans', 'Commanders',
  'Arizona Cardinals', 'St. Louis Cardinals', 'Carolina Panthers', 'Florida Panthers',
  'New York Giants', 'San Francisco Giants', 'New York Jets', 'Winnipeg Jets',
  'Hawks', 'Celtics', 'Nets', 'Hornets', 'Chicago Bulls', 'Cavaliers', 'Mavericks', 'Nuggets', 'Pistons',
  'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves',
  'Pelicans', 'Knicks', 'Thunder', 'Magic', '76ers', 'Suns', 'Trail Blazers', 'Sacramento Kings',
  'Los Angeles Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards',
  'Diamondbacks', 'Braves', 'Orioles', 'Red Sox', 'White Sox', 'Cubs', 'Reds', 'Guardians', 'Rockies',
  'Tigers', 'Astros', 'Royals', 'Angels', 'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees',
  'Athletics', 'Phillies', 'Pirates', 'Padres', 'Mariners', 'Rays', 'Texas Rangers', 'New York Rangers',
  'Blue Jays', 'Nationals',
  'Ducks', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Blackhawks', 'Avalanche', 'Blue Jackets', 'Stars',
  'Red Wings', 'Oilers', 'Wild', 'Canadiens', 'Predators', 'Devils', 'Islanders', 'Senators', 'Flyers',
  'Penguins', 'Sharks', 'Kraken', 'Blues', 'Lightning', 'Maple Leafs', 'Canucks', 'Golden Knights',
  'Capitals', 'Utah Hockey Club',
  'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'FC Cincinnati', 'Colorado Rapids',
  'Columbus Crew', 'D.C. United', 'FC Dallas', 'Houston Dynamo', 'LAFC', 'LA Galaxy', 'Inter Miami',
  'Minnesota United', 'CF Montreal', 'Nashville SC', 'New England Revolution', 'New York City FC',
  'New York Red Bulls', 'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Jose Earthquakes', 'San Diego FC', 'Seattle Sounders', 'Sporting Kansas City', 'St. Louis City',
  'Toronto FC', 'Vancouver Whitecaps',
].map((t) => [t, `put on the ${t} game`]);

const CHANNELS = [
  'ESPN', 'ESPN2', 'FS1', 'FOX', 'CBS', 'NBC', 'ABC', 'CNN', 'Fox News', 'MSNBC', 'CNBC', 'TNT', 'TBS',
  'USA Network', 'NFL Network', 'NFL RedZone', 'MLB Network', 'NBA TV', 'NHL Network', 'Golf Channel',
  'SNY', 'YES Network', 'MSG', 'Big Ten Network', 'SEC Network', 'ACC Network', 'HGTV', 'Food Network',
  'Discovery', 'History', 'Nickelodeon', 'Cartoon Network', 'Disney Channel', 'Bravo', 'AMC', 'FX',
  'Comedy Central', 'The Weather Channel', 'truTV', 'Hallmark Channel', 'A&E', 'TLC', 'Paramount Network',
].map((c) => [c, `put on ${c}`]);

const APPS = [
  ['Netflix', 'Netflix'], ['Hulu', 'Hulu'], ['Disney Plus', 'Disney+'], ['Max', 'Max'],
  ['Prime Video', 'Prime Video'], ['YouTube', 'YouTube'], ['YouTube TV', 'YouTube TV'],
  ['Peacock', 'Peacock'], ['Paramount Plus', 'Paramount+'], ['Apple TV', 'Apple TV'], ['Tubi', 'Tubi'],
  ['Pluto TV', 'Pluto TV'], ['Sling', 'Sling TV'], ['Fubo', 'Fubo'], ['ESPN app', 'ESPN'],
].map(([say, app]) => [say, `open ${app}`]);

const MOODS = [
  'comedy', 'funny movie', 'scary movie', 'horror movie', 'action movie', 'romantic comedy', 'documentary',
  'kids movie', 'family movie', 'thriller', 'drama', 'sci-fi movie', 'Christmas movie', 'animated movie',
  'sitcom', 'crime show', 'reality show', 'true crime documentary', 'feel-good movie', 'classic movie',
].map((m) => [m, `put on a ${m}`]);

const TV_COMMANDS = [
  ['Turn off the TV', 'turn off the tv'], ['Turn on the TV', 'turn on the tv'], ['Mute the TV', 'mute'],
  ['Turn it up', 'volume up'], ['Turn it down', 'volume down'], ['Pause the TV', 'pause'],
  ['Go back to the last channel', 'last channel'], ['Show the guide', 'guide'],
];

const swiftString = (s) => JSON.stringify(s);

function swiftEnum(name, typeName, items) {
  const cases = items.map((_, i) => `c${i}`).join(', ');
  const reps = items.map(([say], i) => `    .c${i}: DisplayRepresentation(title: ${swiftString(say)})`).join(',\n');
  const queries = items.map(([, q], i) => `    case .c${i}: return ${swiftString(q)}`).join('\n');
  return `@available(iOS 16.0, *)
enum ${name}: String, AppEnum {
  case ${cases}
  static var typeDisplayRepresentation: TypeDisplayRepresentation = ${swiftString(typeName)}
  static var caseDisplayRepresentations: [${name}: DisplayRepresentation] = [
${reps}
  ]
  var query: String {
    switch self {
${queries}
    }
  }
}
`;
}

function swiftIntent(name, title, enumName, paramTitle) {
  return `@available(iOS 16.0, *)
struct ${name}: AppIntent {
  static var title: LocalizedStringResource = ${swiftString(title)}
  static var openAppWhenRun: Bool = true

  @Parameter(title: ${swiftString(paramTitle)})
  var choice: ${enumName}

  @MainActor
  func perform() async throws -> some IntentResult {
    await openAssistant(choice.query)
    return .result()
  }
}
`;
}

const SWIFT = `import AppIntents
import UIKit

@available(iOS 16.0, *)
@MainActor
func openAssistant(_ q: String) async {
  var c = URLComponents()
  c.scheme = "tunedtv"
  c.host = "assistant"
  c.queryItems = [URLQueryItem(name: "q", value: q)]
  if let url = c.url {
    await UIApplication.shared.open(url)
  }
}

${swiftEnum('TeamChoice', 'Team', TEAMS)}
${swiftEnum('ChannelChoice', 'Channel', CHANNELS)}
${swiftEnum('AppChoice', 'App', APPS)}
${swiftEnum('MoodChoice', 'Kind of show', MOODS)}
${swiftEnum('TvCommandChoice', 'TV command', TV_COMMANDS)}
${swiftIntent('PutOnTeamGameIntent', 'Put on a game', 'TeamChoice', 'Team')}
${swiftIntent('PutOnChannelIntent', 'Put on a channel', 'ChannelChoice', 'Channel')}
${swiftIntent('OpenTvAppIntent', 'Open an app on the TV', 'AppChoice', 'App')}
${swiftIntent('PutOnMoodIntent', 'Put on something like…', 'MoodChoice', 'Kind of show')}
${swiftIntent('TvCommandIntent', 'TV command', 'TvCommandChoice', 'Command')}
@available(iOS 16.0, *)
struct SurpriseMeIntent: AppIntent {
  static var title: LocalizedStringResource = "Surprise me"
  static var description = IntentDescription("TunedTV picks something on your services and puts it on.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await openAssistant("surprise me")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenRemoteIntent: AppIntent {
  static var title: LocalizedStringResource = "TV Remote"
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "tunedtv://remote") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

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
    AppShortcut(
      intent: SurpriseMeIntent(),
      phrases: [
        "Surprise me on \\(.applicationName)",
        "Surprise me with \\(.applicationName)",
        "\\(.applicationName) surprise me",
        "Put something good on with \\(.applicationName)",
        "What should I watch on \\(.applicationName)",
      ],
      shortTitle: "Surprise me",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: PutOnTeamGameIntent(),
      phrases: [
        "Put on the \\(\\.$choice) game with \\(.applicationName)",
        "Put on the \\(\\.$choice) game on \\(.applicationName)",
        "Watch the \\(\\.$choice) on \\(.applicationName)",
        "\\(.applicationName) put on the \\(\\.$choice) game",
      ],
      shortTitle: "Put on a game",
      systemImageName: "sportscourt"
    )
    AppShortcut(
      intent: PutOnChannelIntent(),
      phrases: [
        "Put on \\(\\.$choice) with \\(.applicationName)",
        "Put on \\(\\.$choice) on \\(.applicationName)",
        "\\(.applicationName) put on \\(\\.$choice)",
        "Switch to \\(\\.$choice) with \\(.applicationName)",
      ],
      shortTitle: "Put on a channel",
      systemImageName: "tv"
    )
    AppShortcut(
      intent: OpenTvAppIntent(),
      phrases: [
        "Open \\(\\.$choice) on the TV with \\(.applicationName)",
        "Open \\(\\.$choice) with \\(.applicationName)",
        "\\(.applicationName) open \\(\\.$choice)",
      ],
      shortTitle: "Open an app",
      systemImageName: "play.tv"
    )
    AppShortcut(
      intent: PutOnMoodIntent(),
      phrases: [
        "Put on a \\(\\.$choice) with \\(.applicationName)",
        "Find me a \\(\\.$choice) on \\(.applicationName)",
        "\\(.applicationName) put on a \\(\\.$choice)",
      ],
      shortTitle: "Put on something like…",
      systemImageName: "film"
    )
    AppShortcut(
      intent: TvCommandIntent(),
      phrases: [
        "\\(\\.$choice) with \\(.applicationName)",
        "\\(.applicationName) \\(\\.$choice)",
      ],
      shortTitle: "TV command",
      systemImageName: "power"
    )
    AppShortcut(
      intent: OpenRemoteIntent(),
      phrases: [
        "Open the \\(.applicationName) remote",
        "\\(.applicationName) remote",
        "TV remote on \\(.applicationName)",
      ],
      shortTitle: "TV Remote",
      systemImageName: "av.remote"
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
