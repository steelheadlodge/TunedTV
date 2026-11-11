# TunedTV 1.0.20 — store listing, TunedTV Plus setup, submit checklist (2026-11-11)

Plan and reasons: `docs/plus-and-marketing-1.0.20.md`. Andrew submits; agents never upload.
Only brands whose driver is `tested: true` are named (LG, Samsung, Roku, Google TV / Android TV,
Fios box, DIRECTV, Xbox). Add Apple TV, Fire TV, Vizio, TiVo when they pass.

## App Store listing

- **Name (30):** TunedTV: TV Remote & Guide (unchanged)
- **Subtitle (30):** Universal remote for every TV
- **Keywords (100):** `samsung,lg,roku,fios,directv,google tv,xbox,screen mirroring,channel,sports,where to watch`
  (words already in the name/subtitle are indexed, so not repeated)
- **Promotional text (170):** Your phone is the remote for every TV and cable box in the house.
  Say "put on the Knicks game in the bedroom": TunedTV knows your channel and changes it.

**Description**

TunedTV is a free universal remote and guide for every TV in your home.

Your phone becomes the remote for your TV and your cable box: LG, Samsung, Roku, Google TV and
Android TV, Verizon Fios, DIRECTV and Xbox, side by side in one app. No ads.

WHAT MAKES IT DIFFERENT
• Changes channels on your Fios or DIRECTV box, not just streaming apps.
• Knows your lineup: "ESPN is 570 on Fios." The right channel number for your provider and ZIP.
• Sports done right: your teams' games, the right local or regional channel, one tap to put it on.
• Room by room: "on the bedroom TV", "on all TVs".
• Shows and movies open on the title in Netflix, Hulu, Disney+, Max, Peacock, Prime Video and more.
• Scenes: Movie night, Bedtime and Game time in one tap, or make your own.
• Simple mode: big buttons and only the basics, for anyone who wants an easy remote.

ASK TUNEDTV
Type or talk: "put on ESPN", "play The Office", "what's a good movie tonight?", "volume up".
Works with Siri: "Ask TunedTV to put on the Mets game."

TUNEDTV PLUS (optional)
• Subscription manager: what you pay for each service, when it renews, which ones you haven't
  opened lately, and cheaper plans.
• Unlimited Ask TunedTV and unlimited scenes.
$4.99 a month or $39.99 a year with a 7-day free trial. The remote, every TV, channel numbers and
sports stay free.

Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least
24 hours before the end of the current period. Manage or cancel in Settings → Apple ID →
Subscriptions. Terms: https://tunedtv.com/terms · Privacy: https://tunedtv.com/privacy

**Screenshots (6.5" x6, iPad 13" x3), in this order:** 1 Remote tab ("One remote for every TV"),
2 Game time scene / sports card with channel ("Your game, your channel, one tap"), 3 cable box
channel change ("Changes channels on your Fios or DIRECTV box"), 4 Movies title with Play on TV,
5 Ask TunedTV, 6 Plus page ("Know what you pay for"). Generate with `scripts/phone-sim/store-shots.mjs`
in tuned-tv-finder, demo TV only.

## Google Play listing

- **Short description (80):** Free universal remote for every TV and cable box, with your channel numbers.
- Full description: same as above, with "Google Play account" in the payment paragraph.

## TunedTV Plus: products (Andrew creates; values exact)

App Store Connect → TunedTV → Monetization → Subscriptions:
- Subscription group: **TunedTV Plus**
- `tunedtv_plus_monthly`: 1 month, **$4.99** (US base, auto-equalized), display name "TunedTV Plus
  Monthly", description "Subscriptions, unlimited Ask, scenes" (≤45 chars)
- `tunedtv_plus_annual`: 1 year, **$39.99**, display name "TunedTV Plus Yearly", same description.
  Introductory offer: **Free, 1 week**, new subscribers.
- Review screenshot for each: the `/plus` page. Review notes: "Profile → TunedTV Plus".
- App Store Connect → Users and Access → Integrations → In-App Purchase key (.p8) for RevenueCat.

Play Console → Monetize → Subscriptions:
- `tunedtv_plus_monthly`, base plan `monthly`, auto-renewing P1M, **$4.99**
- `tunedtv_plus_annual`, base plan `annual`, auto-renewing P1Y, **$39.99**; offer `trial`: free
  trial 7 days, new customers only.
- Service account with Play Developer API access, JSON key for RevenueCat.

RevenueCat (free under $2.5k/month revenue): project **TunedTV**, iOS app `com.tunedtv.app`
(In-App Purchase key above), Android app `com.tunedtv.app` (service account JSON). Entitlement
**`plus`** attached to both products. Copy the public SDK keys (`appl_…`, `goog_…`) into `eas.json`
production env as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. With no
key the shell doesn't advertise `iap` and the page never offers a purchase.

## Submit checklist

1. Products created in both stores and RevenueCat; keys in eas.json.
2. Sandbox test on a real iPhone (TestFlight + sandbox Apple ID): buy annual (trial), restore on a
   second install, cancel; Android license tester the same.
3. Flip `PLUS_LIVE = true` in tuned-tv-finder `src/lib/plus.ts` and publish the web **before**
   Submit for Review, so the reviewer finds Plus under Profile. Old app versions only see "Plus is
   bought in the TunedTV app".
4. Attach both subscriptions to the 1.0.20 version in App Store Connect (first subscriptions must
   be submitted with a build).
5. Paste the listing above, upload the screenshots, Submit for Review (Andrew).

## Not in 1.0.20

- Server-side Plus (unlimited Ask on the server): needs `Purchases.logIn(<supabase user id>)` +
  RevenueCat webhook → `entitlements` table (Lovable Cloud DB, migration through Lovable) +
  `aiQuota.server.ts` reading it. Until then the web's local Plus state can't lift the server's
  20/day Ask limit; do this before marketing "unlimited Ask" or drop that line from the listing.
- Remote outside the app, dedicated remote mode, keep-awake/dim → 1.0.21.
- Profiles + kid mode (planned for Plus, web-only, no build).
