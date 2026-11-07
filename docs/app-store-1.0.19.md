# App Store submission: 1.0.19 (build 39)

Build: tag `tunedtv-1.0.19-39` (commit 8668bce), uploaded by EAS Submit 2026-11-06.
The app loads tunedtv.com, so the web features below are already live for every user.

## What's New (paste into "What's New in This Version")

New in TunedTV:
• No TV handy? Try the demo TV. It shows what every button does, right on your phone.
• Siri: ask TunedTV to put on a game, a channel or an app.
• Control Center and Lock Screen buttons for Ask TunedTV and TV Remote, plus a Next Game widget.
• Talk to TunedTV with the mic, and feel each tap on the remote.
• Simpler setup: pick sports, movies or both, and TunedTV sets itself up around you.
• Fixes and improvements.

## Promotional text (optional, 170)

Change the channel on your cable box, open Netflix on your TV, and find the right channel
for tonight's game. One remote for LG, Roku, Google TV, Fios and DIRECTV.

## App Review notes (paste into "Notes" under App Review Information)

No account is needed. Sign in is optional.

TunedTV controls TVs and cable boxes on the same Wi-Fi as the phone. If there is no
compatible TV where you are testing, use the built-in demo TV:
1. On first launch pick "Live sports", enter ZIP 10001, choose provider "Fios", Continue.
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

All in `app-store-screenshots/1.0.19/`, captured from the live app 2026-11-06 (Fios, 10001, demo
TV), team logos left out. Drag in this order and delete the old ones:

iPhone 6.5" (1284x2778):
0. `iphone-6.5-0-one-remote.png` One remote for every TV
1. `iphone-6.5-1-sports.png` The channel for every game, and one tap puts it on
2. `iphone-6.5-2-ask.png` Just say it: "Put on ESPN in the living room"
3. `iphone-6.5-3-movies.png` What to watch tonight, on the services you pay for
4. `iphone-6.5-4-title.png` Pick a show, play it on TV, or open it on your phone
5. `iphone-6.5-5-remote.png` No TV handy? Try the demo TV

iPad 13" (2064x2752): `ipad-13-0-one-remote.png`, `ipad-13-1-sports.png`, `ipad-13-2-movies.png`

Rebuild: `VW=428 VH=926 DSF=3 SHOTS=/tmp/store/ip node scripts/phone-sim.mjs https://tunedtv.com
$PWD/scripts/phone-sim/store-shots.mjs` (and `VW=1032 VH=1376 DSF=2` for iPad) in tuned-tv-finder,
then `python3 frame_1019.py /tmp/store/ip /tmp/store/ipad` here.

## Listing text (App Information / version page; all within Apple's limits)

- Name (26/30): `TunedTV: Remote & TV Guide`
- Subtitle (29/30): `Universal remote for every TV`
- Keywords (95/100): `fios,directv,roku,lg,google,cable box,channel,sports,game,where to watch,streaming,live,nba,nfl`
  (no app names like Netflix or ESPN: Apple rejects other apps' names in keywords)
- Promotional text (159/170, can change any time without review):
  `Fios and DIRECTV boxes, Roku, LG and Google TV in one remote. Find the channel for tonight's
  game and put it on in one tap, or just say what you want to watch.`

## Steps in App Store Connect

1. Apps > TunedTV > "+" next to iOS App > version 1.0.19.
2. Paste What's New. Add the two lead screenshots.
3. Build: choose 1.0.19 (39) once it says "Ready to Submit" (Apple processing, usually 15-30 min).
4. App Review Information > Notes: paste the notes above.
5. Add for Review > Submit.
