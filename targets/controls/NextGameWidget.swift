import AppIntents
import SwiftUI
import WidgetKit

// Home Screen / Lock Screen widget: your team's next game, its channel, and the score once it
// starts. Data comes from the public https://tunedtv.com/api/public/where-to-watch?team= endpoint
// (no app group needed). Tapping opens Ask TunedTV with "put on the <team> game".

struct NextGameConfig: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Team"
  static var description = IntentDescription("Show the next game for a team.")

  @Parameter(title: "Team", default: "Yankees")
  var team: String
}

struct NextGameEntry: TimelineEntry {
  let date: Date
  let team: String
  let matchup: String?
  let when: String?
  let channel: String?
  let score: String?
  let live: Bool
}

private struct WhereToWatch: Decodable {
  let found: Bool?
  let teams: [Team]?
  struct Team: Decodable {
    let team: String
    let upcoming: [Game]?
  }
  struct Game: Decodable {
    let start: String
    let start_et: String?
    let away: String
    let home: String
    let status: String
    let score: String?
    let channels: [Channel]?
  }
  struct Channel: Decodable { let name: String }
}

struct NextGameProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> NextGameEntry {
    NextGameEntry(date: .now, team: "Yankees", matchup: "Red Sox at Yankees", when: "Tonight 7:05 PM", channel: "YES", score: nil, live: false)
  }

  func snapshot(for configuration: NextGameConfig, in context: Context) async -> NextGameEntry {
    context.isPreview ? placeholder(in: context) : await load(configuration.team)
  }

  func timeline(for configuration: NextGameConfig, in context: Context) async -> Timeline<NextGameEntry> {
    let entry = await load(configuration.team)
    // Live games refresh often; otherwise hourly is plenty.
    let next = Calendar.current.date(byAdding: .minute, value: entry.live ? 5 : 60, to: .now) ?? .now
    return Timeline(entries: [entry], policy: .after(next))
  }

  private func load(_ team: String) async -> NextGameEntry {
    let name = team.trimmingCharacters(in: .whitespaces)
    var comps = URLComponents(string: "https://tunedtv.com/api/public/where-to-watch")!
    comps.queryItems = [URLQueryItem(name: "team", value: name)]
    let empty = NextGameEntry(date: .now, team: name, matchup: nil, when: nil, channel: nil, score: nil, live: false)
    guard let url = comps.url,
      let (data, _) = try? await URLSession.shared.data(from: url),
      let res = try? JSONDecoder().decode(WhereToWatch.self, from: data),
      let t = res.teams?.first
    else { return empty }
    guard let g = t.upcoming?.first(where: { $0.status != "final" }) ?? t.upcoming?.first else {
      return NextGameEntry(date: .now, team: t.team, matchup: nil, when: nil, channel: nil, score: nil, live: false)
    }
    let live = g.status == "live" || g.status == "in"
    let score = g.score.map { $0.replacingOccurrences(of: " (away-home)", with: "") }
    return NextGameEntry(
      date: .now,
      team: t.team,
      matchup: "\(g.away) at \(g.home)",
      when: live ? "Live now" : g.start_et?.replacingOccurrences(of: " ET", with: ""),
      channel: g.channels?.first?.name,
      score: score,
      live: live
    )
  }
}

struct NextGameView: View {
  let entry: NextGameEntry
  @Environment(\.widgetFamily) private var family

  private var link: URL {
    let q = "put on the \(entry.team) game".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    return URL(string: "tunedtv://assistant?q=\(q)")!
  }

  var body: some View {
    Group {
      if family == .accessoryRectangular {
        VStack(alignment: .leading, spacing: 1) {
          Text(entry.matchup ?? entry.team).font(.headline).lineLimit(1)
          Text([entry.live ? entry.score : entry.when, entry.channel].compactMap { $0 }.joined(separator: " · "))
            .font(.caption).lineLimit(1)
        }
      } else {
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 4) {
            Image(systemName: "sportscourt")
            Text(entry.live ? "LIVE" : "NEXT GAME").font(.caption2).bold()
          }
          .foregroundStyle(entry.live ? Color.red : Color.secondary)
          if let m = entry.matchup {
            Text(m).font(.headline).lineLimit(family == .systemSmall ? 3 : 2).minimumScaleFactor(0.8)
            if entry.live, let s = entry.score { Text(s).font(.title3).bold() }
            if let w = entry.when, !entry.live { Text(w).font(.caption) }
            Spacer(minLength: 0)
            if let c = entry.channel {
              Label(c, systemImage: "tv").font(.caption).lineLimit(1)
            }
          } else {
            Text(entry.team).font(.headline)
            Text("No game scheduled. Edit the widget to pick a team.").font(.caption).foregroundStyle(.secondary)
            Spacer(minLength: 0)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .widgetURL(link)
    .containerBackground(for: .widget) { Color("$widgetBackground") }
  }
}

struct NextGameWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "NextGame", intent: NextGameConfig.self, provider: NextGameProvider()) { entry in
      NextGameView(entry: entry)
    }
    .configurationDisplayName("Next Game")
    .description("Your team's next game and where it's on. Tap to put it on your TV.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
