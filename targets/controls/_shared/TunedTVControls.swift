import AppIntents
import SwiftUI
import WidgetKit

// In _shared so it compiles into both the app and the extension: an intent with
// openAppWhenRun must exist in the app target too (https://developer.apple.com/forums/thread/763851).

@available(iOS 18.0, *)
struct OpenAskTunedTVIntent: ControlConfigurationIntent {
  static let title: LocalizedStringResource = "Ask TunedTV"
  static let description = IntentDescription("Say or type what to watch and TunedTV puts it on your TV.")
  static let isDiscoverable = true
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tunedtv://assistant?mic=1")!))
  }
}

@available(iOS 18.0, *)
struct OpenTvRemoteIntent: ControlConfigurationIntent {
  static let title: LocalizedStringResource = "TV Remote"
  static let description = IntentDescription("Open the TunedTV remote for your TV.")
  static let isDiscoverable = true
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tunedtv://remote")!))
  }
}

@available(iOS 18.0, *)
struct AskTunedTVControl: ControlWidget {
  static let kind = "com.tunedtv.app.controls.ask"
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenAskTunedTVIntent()) {
        Label("Ask TunedTV", systemImage: "sparkles.tv")
      }
    }
    .displayName("Ask TunedTV")
    .description("Put a game, channel, movie or show on your TV.")
  }
}

@available(iOS 18.0, *)
struct TvRemoteControl: ControlWidget {
  static let kind = "com.tunedtv.app.controls.remote"
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenTvRemoteIntent()) {
        Label("TV Remote", systemImage: "av.remote")
      }
    }
    .displayName("TV Remote")
    .description("Open the TunedTV remote.")
  }
}
