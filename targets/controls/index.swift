import SwiftUI
import WidgetKit

@main
struct TunedTVControlsBundle: WidgetBundle {
  var body: some Widget {
    AskTunedTVControl()
    TvRemoteControl()
  }
}
