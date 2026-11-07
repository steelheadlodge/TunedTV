# App Store submission: 1.0.19 (build 39)

Build: tag `tunedtv-1.0.19-39` (commit 8668bce), uploaded by EAS Submit 2026-11-06.
The app loads tunedtv.com, so web changes reach every user when tuned-tv-finder is published.
Publish before submitting: the reviewer sees whatever tunedtv.com serves that day.

## What's New (paste into "What's New in This Version")

New in TunedTV:
• Play it on your TV: pick a movie or show and it opens in the right app on your TV. Away from home, it opens on your phone instead.
• Browse on TV: put the Movies listings on your TV and scroll on your phone. The TV follows along.
• Choose where to watch when a title is on more than one service, with the ones you have first.
• Free movies and shows, no subscription, near the top of Movies.
• Genre pages: tap Comedy, Horror, Romance and more to see everything in that genre.
• Trailers play on your phone or on your TV.
• Swipe pad: a touchpad remote, one tap from the arrow buttons.
• No TV handy? Try the demo TV. It shows what every button does, right on your phone.
• Siri: ask TunedTV to put on a game, a channel or an app.
• Control Center and Lock Screen buttons for Ask TunedTV and TV Remote, plus a Next Game widget.
• Talk to TunedTV with the mic, and feel each tap on the remote.
• Simpler setup: pick sports, movies or both, and TunedTV sets itself up around you.
• More reliable TV pairing and channel changes, plus fixes.

## App Review notes (paste into "Notes" under App Review Information)

No account is needed. Sign in is optional.

TunedTV controls TVs and cable boxes on the same Wi-Fi as the phone. If there is no
compatible TV where you are testing, use the built-in demo TV:
1. On first launch pick "Live sports", enter ZIP 10001, choose provider "Fios", Continue.
   On "Your teams" pick any team (or none) and tap Continue again.
2. On "Your TV", tap "No TV here? Try the demo TV". The remote opens with a demo screen
   that shows each channel, app, and volume change.
   (Later: Remote tab or Profile > My TVs > "No TV here? Try the demo TV".)
3. On the Sports tab, tap "Tune <channel>" on any game. The demo TV changes to that channel.

Permissions:
- Local Network: only to find and control the TV and TV box on the user's Wi-Fi.
- Microphone and Speech Recognition: only when the user taps the mic to talk to TunedTV.
- Notifications: optional alerts before the user's teams play. Asked only after they pick a team.

Siri: "Ask TunedTV". Control Center: "Ask TunedTV" and "TV Remote". Widget: "Next Game".

## Screenshots (replace the whole set; the 1.0.14 images show old tabs and the old Ask box)

All in `app-store-screenshots/1.0.19/`, captured from the live app 2026-11-06 (demo TV). The first
image is the lead because "the channel for tonight's game, one tap" is the reason to download; a
plain universal remote is a crowded pitch. Drag in this order and delete the old ones:

iPhone 6.5" (1284x2778), from the real phone 2026-11-06, status bar removed:
1. `iphone-6.5-1-sports.png` Tonight's game, your channel, and one tap puts it on
2. `iphone-6.5-2-ask.png` Just say what you want on, and your TV changes
3. `iphone-6.5-3-remote.png` The remote on your phone, your channels, one tap
4. `iphone-6.5-6-ontv.png` Play it on your TV, or open it on your phone
5. `iphone-6.5-5-movies.png` What to watch tonight, picked for you
6. `iphone-6.5-8-free.png` Free movies, no subscription
7. `iphone-6.5-7-swipe.png` Prefer to swipe? Tap the corner to switch

`6-ontv` is Apocalypse Z from the phone 2026-11-06 9:32 PM (after f6180cd): one service, Play on
Living Room TV, trailer on phone or TV. Replaces the Jaws 2 shot.

`8-free` is the phone 2026-11-06 10:15 PM (after 986f9a8): Trending free movies near the top of
Movies, one name per app ("Free · YouTube"), Netflix Top 10 under it. Same frame as `6-ontv`.
`5-movies` is the phone 2026-11-06 10:02 PM: Browse on TV button, Discover card, Picks for you.

iPad 13" (2064x2752), the real iPad capture (the app runs as one centered column there):
1. `ipad-13-1-sports.png` Tonight's game, your channel
2. `ipad-13-2-remote.png` The remote for your TV
Not two phone screens side by side: App Review rejects iPad shots that show iPhone screens.

Rebuild: `VW=428 VH=926 DSF=3 SHOTS=/tmp/store/ip node scripts/phone-sim.mjs https://tunedtv.com
$PWD/scripts/phone-sim/store-shots.mjs` (and `VW=1032 VH=1376 DSF=2` for iPad) in tuned-tv-finder,
then `python3 frame_1019.py /tmp/store/ip /tmp/store/ipad` here, then `python3 fix_1019.py /tmp/store/ipad`
(captions clear of the frame, no TMDB block on the ask shot, real iPad screens).

## Listing text (App Information / version page; all within Apple's limits)

- Name (26/30): `TunedTV: Remote & TV Guide`
- Subtitle (30/30): `The remote that finds the game`
  Not "for every TV": the app works with LG, Roku, Google TV, Fios and DIRECTV, and the TV step says so.
  Guideline 2.3.1 wants metadata to match what the app does.
- Keywords (95/100): `universal,control,smart,where to watch,cable box,channel,live,sports,game,movies,shows,football`
  With the name (remote, TV, guide) and subtitle this covers universal remote control, tv remote,
  smart tv remote, tv guide and where to watch. "where to watch" left the name, so it is here.
  Words already in the name and subtitle (remote, TV, guide) are searched anyway, so they aren't repeated here.
  No company or brand names: guideline 2.3.7 says metadata can't be packed with trademarked terms
  or other companies' names, and the keyword field is where that gets rejected.
- Promotional text (140/170, can change any time without review):
  `Your cable box and smart TV in one remote. Find the channel for tonight's game and put it on in one tap, or just say what you want to watch.`
  (Was "every smart TV": not every TV works, guideline 2.3.1.)

- Description (replaces the 1.0.14 "where to watch" text):

```
The channel for tonight's game, and the remote to put it on.

TunedTV knows which channel every game is on with your TV provider, and changes your TV or cable box to it in one tap. Or just say what you want to watch.

LIVE SPORTS
• The exact channel number for every game on your TV provider
• Your teams first, plus a Next Game widget
• One tap tunes your cable box or opens the right app on your TV

THE REMOTE ON YOUR PHONE
• Channels, apps, volume and arrows, or a swipe pad
• Works over your Wi-Fi with many smart TVs, streaming players and cable boxes
• No TV handy? Try the demo TV and see what every button does
• Siri, Control Center and Lock Screen buttons

WHAT TO WATCH
• Picks for you from the services you already have
• See where any movie or show is streaming, and play it on your TV in one tap
• Free movies and shows, no subscription
• Browse the listings on your TV and scroll from your phone
• Away from home? Titles open on your phone instead

No account needed.
```

The app's own screens name providers, channels and streaming apps, because that's how it tells you
where to watch. That's the app doing its job. Our own words (name, subtitle, keywords, promotional
text, screenshot captions) name nobody.

## Steps in App Store Connect

0. Publish tuned-tv-finder (Lovable) so tunedtv.com has tonight's fixes.
1. Apps > TunedTV > "+" next to iOS App > version 1.0.19.
2. Paste What's New, the subtitle, keywords and promotional text. Replace the screenshots with the set above, in order.
3. Build: choose 1.0.19 (39) once it says "Ready to Submit" (Apple processing, usually 15-30 min).
4. App Review Information > Notes: paste the notes above.
5. Add for Review > Submit.
