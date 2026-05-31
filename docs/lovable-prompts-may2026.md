# TunedTV — Lovable prompt pack (May 2026)

Run in order. Publish after each prompt when Lovable asks.

Decisions locked:
- Email alerts on 👎 → support@tunedtv.com
- Onboarding: search + popular near ZIP + A–Z + "not listed"
- Sign-in required for 👎 / channel corrections
- IA lean: Home sports-first, Discover → "Movies & Shows"

---

## Prompt 1 — Thumbs down ops alerts + sign-in gate

```
Implement channel feedback alerts and require sign-in for corrections.

THUMBS DOWN / CORRECTIONS
- Require authenticated user to submit thumbs up OR thumbs down on channel results (vote === -1 or suggested channel correction).
- If guest taps 👎 or 👍: show modal "Sign in to verify channel listings — it helps us fix data for your area." with sign-in CTA (Apple, Google, email). Do not record vote until signed in.
- When signed in, every feedback row MUST include from user profile/prefs (never ask again if already set):
  - zip_code
  - provider_id and provider display name
  - dma_id / dma_name if available
  - network name shown
  - channel_number_shown (nullable)
  - suggested_channel (nullable, from 👎 correction input)
  - game_or_title context (team names, event title, or search query)
  - user_id
  - created_at
- Dedupe: same user + same event/network/provider within 24h → update existing row, do not insert duplicate.

EMAIL ALERT (thumbs down only)
- On new thumbs down (vote -1) OR thumbs down with suggested correction, send email to support@tunedtv.com.
- Use Supabase Edge Function + Resend (or existing email integration). If Resend not configured, add TODO and log clearly in function; wire Resend API key from secrets.
- Subject format: [TunedTV] 👎 {provider} {zip} — {network} showed {shown}, user says {suggested or "wrong"}
- Body: all fields above + link back to admin context if possible.
- Rate limit: max 20 alert emails per user per day (still save to DB).

DATABASE
- Extend channel_feedback (or equivalent) with: needs_review boolean default true on 👎, resolved_at nullable, alert_sent_at nullable.
- Ensure RLS: users can insert own feedback; only service role reads all.

UI
- Keep 👍 low friction for signed-in users (+2 points toast if points system exists).
- 👎 flow: tap 👎 → if not signed in, sign-in modal → if signed in, optional "What's the correct channel?" input → submit → toast "Thanks — we'll review this listing."
```

---

## Prompt 2 — Onboarding provider picker

```
Redesign the cable/satellite provider step in onboarding (after ZIP, before streaming services).

LAYOUT (top to bottom)
1. Search input: "Search providers..." filters all lists live (match display name and aliases, e.g. "Verizon" matches "Verizon Fios").
2. Section "Popular near you" — show 6–8 providers using ZIP→city/DMA label in header, e.g. "Popular near East Rockaway (11518)":
   - Verizon Fios, Xfinity, Spectrum, Cox, DirecTV, Dish, YouTube TV, Hulu + Live TV
   (Use provider keys we already have channel data for; map display names to internal ids: fios, xfinity, spectrum, cox, directv, dish, youtube_tv, hulu_live.)
3. Collapsible "See all providers (A–Z)" — full sorted list.
4. Link "My provider isn't listed" → small form: provider name (required), optional note → save to provider_requests table with zip, dma, user_id if signed in, created_at → toast "Thanks — we'll work on adding your provider" → allow user to continue onboarding with best-effort or skip provider (if skip, show banner in Profile to complete later).

BEHAVIOR
- Single-select for primary cable/satellite provider (keep current prefs shape).
- Persist to user prefs / profile same as today.
- Do not show fake "only these providers exist in your ZIP" — honest copy only.

OPTIONAL (same prompt if small): After provider + streaming steps, ask "What do you use TunedTV for?" [Live sports] [Movies & TV] [Both] — store in prefs.useCase; default Home tab for sports/both, Discover for movies-only (can stub navigation preference for later).
```

---

## Prompt 3 — Provider request alerts

```
When a user submits "My provider isn't listed" during onboarding (provider_requests table):

- Send email to support@tunedtv.com
- Subject: [TunedTV] Provider request — {name} in {zip}
- Body: provider name, zip, dma, user email if signed in, note, timestamp

Reuse same Edge Function / Resend setup as channel feedback alerts.
```

---

## Prompt 4 — Movies & Shows tab (IA split, phase 1)

```
Rename Discover tab to "Movies & Shows" (label + route title). Home becomes sports-first.

HOME TAB
- Default category: Sports (or hide All/Movies/Shows tabs on Home — sports schedule only).
- Keep "On tonight" / live games with channel badges and thumbs (signed-in only for thumbs).
- Optional single row at bottom: "Leaving soon on your services" → navigates to Movies & Shows (max 4 tiles). Skip if empty.

MOVIES & SHOWS TAB (formerly Discover)
- Move here: Leaving Soon, Just Added (Watchmode), movie/show browse, title detail links.
- Add sections (use existing data where possible; stub empty states gracefully):
  1. Your favorites — favorite shows/series (new, mirror Favorite Teams UX)
  2. New & premiering
  3. Trending
  4. Leaving soon (Watchmode)
  5. Just added (Watchmode)
- Favorite shows: add picker like Profile favorite teams — search + multi-select; store favoriteShows[] in prefs (localStorage + sync to Supabase profile when signed in).

FINDER TAB
- Unchanged for now: universal search including sports; channel numbers for provider.

Do not remove Watchlist from Profile yet; link from Movies & Shows header optional.
```

---

## Prompt 5 — Favorite shows picker (if not done in Prompt 4)

```
Add favorite TV shows/series selection:

- Profile section "Favorite shows" + optional onboarding step for Movies/Both useCase (skippable).
- Search titles from existing catalog API; store as favoriteShows: { id, title, kind }[].
- Movies & Shows tab section "Your favorites" reads this list and surfaces related titles/episodes when data exists.
- Same sign-in optional for browse; syncing favorites requires account (merge local on sign-in like teams).
```

---

## After publish — smoke test

1. Guest: 👎 → sign-in prompt, no DB row
2. Signed in: 👎 on Fios game → email to support@tunedtv.com with zip 11518
3. Onboarding: search "fios", pick from Popular, complete flow
4. "Not listed" → email + row in provider_requests
5. Home shows sports; Discover labeled Movies & Shows
