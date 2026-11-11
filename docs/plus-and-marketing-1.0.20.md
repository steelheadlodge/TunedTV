# TunedTV Plus + new marketing (plan, 2026-11-10)

Checked against the Tuned (3SCORERS, UK) iPhone walkthrough, our own code and the revenue order
agreed 2026-11-07 (memory: venues first, then a paid user tier built on subscription management
+ comparison + unlimited Ask; check Apple in-app rules before billing). Andrew OK'd building it
for the next submissions.

## Already have (do not rebuild)

- Editable remote: app row star/hide/add, hold-and-slide reorder, pinned channels, swipe pad,
  left-handed, haptics (TvRemotePad).
- Watchlist, match reminders + push, hidden titles, cheapest way to watch (cheapest.ts).
- Rating prompt only after 2 days of use and 2 happy moments (ratingPrompt.ts). Keep it.
- Ask limit: 20/day free (aiQuota.server.ts), PRO_USER_IDS placeholder for paid users.
- No ads. Keep it that way: Tuned's ad screen + tracking prompt + rating prompt in the first
  3 minutes is its weakest moment.

## Missing, worth building

| Feature | Tier | Needs a build? |
|---|---|---|
| "Just need a remote?" path first in onboarding + "Press volume up, did the TV show it?" check | Free | No (web). Build on branch onboarding-no-skip, now unblocked (1.0.19 live 2026-11-08) |
| Simple mode: big buttons, power/vol/CH/Last/Home/OK only (grandma) | Free | No |
| Scenes: Movie night, Bedtime, Game time (my team's game on the right TV) | Free: 2 scenes. Plus: unlimited | No |
| Subscription manager: what you pay, what you use, renewals, cheapest combo for your teams/shows | Plus | No |
| Unlimited Ask | Plus | No (flip from PRO_USER_IDS to entitlement) |
| Profiles + kid mode (hides titles above a rating everywhere, Ask included) | Plus | No |
| Remote outside the app (Live Activity, Control Center, widget; Android bubble/notification) | Free | Yes (already planned in next-native-build.md) |
| In-app purchase (StoreKit / Play Billing) + Restore purchases | — | Yes |

## Never gate

Every TV and box in the home, the full remote, channel numbers, sports, where-to-watch, 👍/👎.
"One remote for every TV" is the marketing line; charging per TV (Tuned Plus caps 2 devices)
would contradict it.

## Price (proposed, Andrew to confirm)

TunedTV Plus: $4.99/month or $39.99/year, 7-day free trial on annual only. No weekly plan
(weekly paywalls are what draw 1-star reviews in this category). Tuned charges $3.99/$39.99
(Plus) and $7.99/$79.99 (Pro). One tier to start; a Home/Family tier only if usage asks for it.

## Billing

- iOS: StoreKit auto-renewing subscription (Guideline 3.1.1; external purchase links in the US
  are possible but add review risk, skip for now). Android: Play Billing.
- RevenueCat (`react-native-purchases`) in the shell: one SDK for both stores, receipts, trial
  logic, webhooks. Free under $2.5k/month revenue.
- Shell tells the web the entitlement over `postNative` (`plus` cap); server trusts only the
  RevenueCat webhook -> `entitlements` table (Lovable Cloud DB pbjx: migration goes through
  Lovable, not migrate-supabase).
- Paywall must show price, period, trial terms, Terms + Privacy links, Restore purchases
  (Guideline 3.1.2). Andrew creates the subscription group + 2 products in App Store Connect
  and Play Console; agent prepares the exact values.
- Venues (Game Day Screen) stay on web card billing, separate from this.

## Order

1. Web, no build (ship on Lovable Publish as each lands): remote-first onboarding + volume
   check, Simple mode, Scenes, subscription manager, profiles/kid mode, paywall screens behind
   a flag.
2. 1.0.20 build: RevenueCat + paywall wiring + what is already in the tree (Android mirroring,
   iOS keyboard). First subscription review is the risky part, so keep this build small.
3. 1.0.21 build: remote outside the app, dedicated remote mode, keep-awake/dim (all in
   next-native-build.md). Bigger native surface, separate review.

## Marketing for these submissions

- Name: keep "TunedTV: TV Remote & Guide". Subtitle: "Universal remote for every TV" (29).
  Searchers type "universal remote"; Tuned owns "Universal TV Remote" in its name.
- Keywords: add universal remote, tv remote control, screen mirroring, samsung remote, fios,
  apple tv remote (only brands whose driver is marked tested at submit time).
- Description lead: free remote for every TV and cable box + the right channel for your game.
  Then "TunedTV Plus" section (what it adds, price, trial). "Free. No ads." stays true.
- Screenshots: first shot = the remote (what searchers came for), second = "Game time: your
  team's game, right channel, one tap", third = cable box control, then Movies, Ask, Plus.
- Listing text and screenshot set go in docs/app-store-1.0.20.md with the build.
