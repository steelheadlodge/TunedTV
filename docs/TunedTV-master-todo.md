# TunedTV — Master to-do (living doc)

Last updated: 2026-05-29  
Workflow: one Lovable prompt → Publish → test → confirm → next.

**App Store:** iOS **1.0.9 (#19)** — **Waiting for Review** (resubmitted 2026-05-29 ~5:32 PM). Do not Lovable-publish during review except emergencies.

**📌 Channel data reminder:** Fios **TNT 753 → 551** (11518, user verified). Process + automation plan → [`docs/channel-data-pipeline.md`](channel-data-pipeline.md)

**🔔 When Apple approves, say:** `go post-launch` — channel accuracy path: **#10 → #14 → #19 → #20** (see pipeline doc § “After launch”).

---

## 📋 Post-approval fix order (master list)

| Order | # | Fix | Type |
|-------|---|-----|------|
| 1st publish | 1–9, 3b | **Batch A** — perf, cache, tab lag | Lovable |
| 2nd | 10 | Streaming display (Prime/Max dedupe) | Lovable |
| 3rd | 11 | Screenshot freeze hardening | Lovable |
| 4th | 12 | Security backlog | Lovable |
| 5th | 13 | **Title reviews UX** (one per user, edit, no stack on tiles) | Lovable |
| 6th | 14 | **Grant admin SQL** (your UUID → `user_roles`) | You, Supabase |
| 7th | 15 | **Admin review moderation** (`/admin/reviews`, Report queue) | Lovable |
| 8th | 16 | **Ask Finder day/date parsing** (tomorrow, Mon–Sun) | Lovable |
| 9th | 17 | **Channel # always on top** (provider + ch. before stream pills) | Lovable |
| 10th | 18 | **Watching / tracking UX sync** (lists feel linked) | Lovable |
| 11th | 19 | **Leaderboard tally after thumbs vote** | Lovable |
| 12th | 20 | **Channel data auto-promote** (votes → DB, no manual SQL) | Lovable + Edge Function |
| 13th | 21 | **Sports upcoming UX** (league filter shows next 5–8 games, not empty) | Lovable |

**Hold all until Apple approves** (except #14 you can run anytime — no app publish).

**Channel accuracy playbook:** [`docs/channel-data-pipeline.md`](channel-data-pipeline.md) — seed, crowd, automate; you should not fix every ZIP by hand.

**Product tiers & events (Pro roadmap):** [`docs/product-tiers-and-events.md`](product-tiers-and-events.md) — free verified finder → network → subs.

---

## 🚀 P0 — First publish AFTER Apple approval (Batch A)

**Symptoms this fixes:** 3–4s cold start, tab lag/flash, Finder/Sports not loading until force-quit, tab highlight ≠ content, re-fetching all data every tab switch.

| # | Fix | Impact |
|---|-----|--------|
| 1 | **BottomNav** — remove 450ms `location.assign` fallback + stop `preventDefault` | 🔥 Tab load failures + flash |
| 2 | **AuthInvalidator** — invalidate only user-scoped keys; skip INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED | 🔥 Stops cache wipe on every auth event |
| 3 | **Home loader** — defer movies/shows to client `useQuery`; keep `getGames` only (or skeleton first) | 🔥 Cold start first paint |
| 4 | **`pendingComponent`** skeletons on `/` and tab routes | Feels faster while loading |
| 5 | **De-dupe `getSession()`** in AppShell — one subscription | Cold start |
| 6 | **Defer** `autoAssignUsername` / `syncOnSignIn` (idle or ~1.5s) | Cold start |
| 7 | **Loader `Promise.race` 2s timeout** on getGames (optional, with #3) | Cold start white screen |
| 8 | **Preload** 5 tab routes on mount | Repeat tab visits from cache |
| 9 | **Defer** `useProviderChannelCache` until after first paint | Cold start main-thread work |
| 3b | **Loaders → TanStack Query** (`ensureQueryData` / suspense) for `/` and `/discover` | Cache hits on tab switch (~60s stale) |

**Do NOT touch during Batch A:** AppShell Sign In UI, `login.tsx`, `NativeAuthBridge.tsx`, Cloud Authentication settings.

**Copy-paste to Lovable when approved:**

```
go post-launch — implement post-approval Batch A:
BottomNav fix (#1), AuthInvalidator scope (#2), home loader defer movies/shows (#3),
loaders → ensureQueryData/suspense, pendingComponent skeletons (#4),
AppShell getSession dedupe (#5), defer syncOnSignIn/autoAssignUsername (#6),
optional 2s loader race on getGames (#7), tab preload (#8),
defer providerChannelCache (#9).

Publish once. Do not touch auth: AppShell Sign In, login.tsx,
NativeAuthBridge, Cloud Authentication. Hold security backlog until smoke test passes.
```

**Smoke test after publish:**

```
□ Force-quit → open (count cold start — target ~2s, skeleton not blank)
□ Sports → Movies → Alerts → Profile → Sports rapidly (no hang/flash/mismatch?)
□ Same tabs within 60s (cached — near-instant?)
□ support@ demo login
□ Thumbs up on one game row
```

---

## 🚀 P0b — Same week after Batch A smoke test

### Streaming / provider display cleanup (#10)

**Verified on phone 2026-05-27 (ZIP 11518, Fios):**

| Game | ✅ Correct | ❌ Fix |
|------|-----------|--------|
| CAR @ MTL (NHL) | truTV **ch. 683** on Fios; **TNT ch. 551 HD** (user verified 11518, 2026-05-27) | **TNT ch. 753** — **wrong seed**; fix `provider_channel` fios/TNT → **551** (NY DMA). User: game is on **551**, not 753 |
| CAR @ MTL (NHL) | — | **HBO Max · stream** — wrong; don’t map TNT/truTV → Max |
| NYY @ KC (MLB) | Prime as watch path plausible | **Redundant:** green “✓ On Amazon Prime” **and** “Prime Video · stream” on same card |
| MIN @ CHW, HOU @ TEX | “Not on your services” for RSN gaps | Keep — honest UX |
| Charles Schwab Challenge golf (2026-05-28) | **Golf Channel** Thu 4–7 PM ET; CBS/Paramount+ Sat–Sun only | **Wrong:** green “On Fios · ESPN · ch. 570” — ESPN+ streaming ≠ linear ESPN; prioritize Golf Chnl + day-aware schedule |
| WCWS softball (2026-05-28) | **ESPN ch. 570** for noon / 2:30 PM games; **ESPN2** for 7 PM+ | Channel OK for ESPN games — must show **correct game + time**, not wrong sport (e.g. golf) |
| MIA @ NYM (MLB, 2026-05-29) | **Fios ch. 11** (11518, user verified 2026-05-29) | **Wrong:** green “On Fios · ESPN · ch. 570” — national ESPN tag ≠ local broadcast; prefer local ch. 11 over 570 for this game |
| MIA @ NYM (MLB, 2026-05-30) | **SNY ch. 577** (11518, user verified 2026-05-30; Fios guide) | **Wrong:** green “On Fios · SNY · ch. 578” — seed off by 1; fix `provider_channel` fios/SNY **578 → 577** (NY DMA) |

**Fios TNT seed bug (user report 2026-05-27):** `provider_channel` has `fios + TNT → 753`. User **11518 confirmed game on TNT ch. 551** (matches [Verizon lineup PDF](https://www.verizon.com/content/dam/verizon/support/consumer/documents/verizon_consumer_fios_tv_channel_lineup.pdf): TNT 51/551 HD). Fix seed: **753 → 551** for Fios NY DMA.

**Warner (TNT/truTV):** Show cable + channel # only when verified or correct seed. Max/HBO Max chip only when broadcast data **explicitly** includes Max simulstream — not by default.

**Copy-paste to Lovable (after Batch A passes):**

```
Streaming display cleanup:

1. Amazon: If user has Amazon Prime in profile, show ONE label on a game card —
   "✓ On Prime Video" OR "✓ On Amazon Prime", not both. Watch/deeplink uses Prime Video.

2. Warner (TNT/truTV): Do NOT auto-add HBO Max/Max stream chip.
   Only show Max when broadcast data explicitly includes Max simulstream.
   Rename any "HBO Max" UI strings to "Max".

3. Deduplicate: if green "On X" badge matches a stream pill, hide the redundant pill.

4. Audit WBD + Amazon mappings in resolveWhereToWatch / streaming.ts.

5. Fios TNT channel seed: provider_channel has fios/TNT=753 — WRONG.
   User 11518 verified: TNT = **551 HD** on Fios (game on 551 tonight).
   Update seed 753 → 551 for Fios NY DMA. truTV stays 683 HD.

Test: CAR @ MTL → "On Fios · TNT · ch. 551" + truTV ch. 683, NO ch. 753, NO Max chip.
NYY @ KC (if on Prime) → one Prime label only.

6. ESPN+ vs ESPN: Never map PGA Tour Live / ESPN+ streams to linear "ESPN · ch. 570".
   Golf Thu-Fri → Golf Channel (Fios ~593 HD). CBS/Paramount+ only Sat-Sun for that event.

7. Multi-day events: broadcast network must match TODAY's window, not whole-tournament defaults.
   WCWS May 28: ESPN noon/2:30 PM, ESPN2 7 PM+ — show correct game row, not wrong sport on ESPN chip.
```

**ESPN+ ≠ ESPN (2026-05-28):** Charles Schwab golf wrongly promoted ESPN 570; WCWS on ESPN 570 **is correct** for linear ESPN games that day ([NCAA schedule](https://www.ncaa.com/news/softball/article/2026-05-24/2026-ncaa-softball-tournament-bracket-schedule-womens-college-world-series-scores)).

| # | Fix | Notes |
|---|-----|-------|
| 10 | **Streaming display cleanup** (above) | Not an App Store blocker — trust/accuracy |
| 11 | **Screenshot freeze hardening** (4 fixes) | visualViewport debounce, duplicate auth listener cleanup, save timeouts |
| 12 | **Security backlog** | vote manipulation, dev routes, RLS — after perf stable |
| 13 | **Title reviews UX** (P1c — approved) | One review/user/title, Edit, aggregate on favorites, full list on title page |
| 14 | **Grant admin access** | One-time SQL — see Admin section; enables `/admin/feedback` |
| 15 | **Admin review moderation** | `/admin/reviews` — hide/delete reported reviews; wire Report button |
| 16 | **Ask Finder day/date parsing** | tomorrow + weekday names must filter hero + results |
| 17 | **Channel # always on top** | User's provider + ch. # first on every game card |
| 18 | **Watching / tracking UX sync** | Mark as watching ↔ Watching linked across all surfaces |
| 19 | **Leaderboard tally after vote** | 👍/👎 must bump score + refresh Top tab |
| 20 | **Channel data auto-promote** | Aggregate by **provider + DMA** (not per-ZIP); admin one-click + daily digest — see pipeline § #20b |
| 21 | **Sports upcoming UX** | No “No matches” on quiet days — show next 5–8 in league; 14d in playoffs |

---

## 🔍 P1d — Ask Finder date parsing (#16)

**Reported 2026-05-27 (ZIP 11518, Fios, app date Wed May 27):**

| Query | Expected | Actual (bug) |
|-------|----------|--------------|
| `Yanks tomorrow` | Thu May 28 NYY game | Hero = **Wed May 27** (today) |
| `Yankees Monday` | Next Mon (Jun 2?) NYY game | Hero = today; Mon not prioritized |
| `Yankees Saturday` / `Yanks Saturday` | Sat May 30 @ ATH | Hero = today; Sat in "More games" only |
| `Yankees Sunday` | Sun May 31 | Same — wrong hero |
| `Yankees sat` / `Yanks sat` | Sat May 30 | ✅ **Works** — single correct result |

**Root cause (likely):** `askParser.ts` applies team filter but **day window not enforced on hero/first result** — full weekday names and `tomorrow` not parsed same as `sat`; results show all upcoming NYY games with today as featured card.

**Copy-paste to Lovable (post-approval, after Batch A or with #10):**

```
Ask Finder date parsing fix (askParser.ts + AskFinder hero selection):

BUG: Day keywords don't filter results consistently.
- "Yankees tomorrow" shows today's game as hero (Wed May 27) not tomorrow
- "Yankees saturday/monday/sunday" shows today as hero; correct day only in "More games"
- "Yankees sat" works correctly — use same logic for all forms

Fix applyAsk / parseAsk:

1. Normalize day tokens (case-insensitive, strip from team query):
   tomorrow → dayOffset +1 from user-local today
   today, tonight → dayOffset 0
   mon/monday, tue/tuesday, wed/wednesday, thu/thursday/thurs,
   fri/friday, sat/saturday, sun/sunday → next occurrence of that weekday 
   (if today IS that weekday before game time, include today; else next)

2. When ANY day token present: filter games to that calendar date ONLY 
   (user timezone / ET game dates). No "more games" from other days.

3. Hero / first card = earliest game on filtered date (not first game in 7-day window).

4. Summary line: "Results for yankees · sat · Fios" should include parsed day.

5. If no game on requested day: "No Yankees game Saturday — next: Sun May 31" 
   (optional one-line hint), not wrong-day hero.

Test matrix (Wed May 27 context):
- Yanks tomorrow → Thu May 28 only (or empty + hint)
- Yankees saturday → Sat May 30 NYY @ ATH (hero)
- Yankees sat → same as saturday
- Yanks tonight → today's game only
- NYY (no day) → next 7 days unchanged
```

**App Store:** Not a blocker — Ask is beta; fix post-approval.

---

## 📺 P1e — Channel number always on top (#17)

**Reported 2026-05-27:** On Ask Finder / game cards, when user has a **channel number** for their provider (e.g. `✓ On Fios · YES Network · ch. 576`), it should **always appear first** — above stream-only pills (NBC Sports California, MLB.tv, Prime Video, etc.).

**Example bug:** `Yanks sat` → Sat NYY @ ATH shows **NBC Sports California** pill before green **Fios · YES · ch. 576**.

**Rule (everywhere game watch options render — Home, Ask Finder, search, favorites):**

| Priority | Show |
|----------|------|
| **1** | Green **✓ On {provider} · {network} · ch. {###}** (user's lineup) |
| **2** | Other linear networks with ch. # for user's provider |
| **3** | Stream-only · stream pills |
| **4** | "Not on your services" / signup CTAs |

**Copy-paste to Lovable (post-approval; can ship with #10 or #16):**

```
Game card watch-option ordering — channel number always on top:

When rendering broadcast/watch badges on game cards (Home, Ask Finder, 
search results, hero card):

1. Sort watch options so ANY option with a channel number for the 
   user's provider ranks FIRST.

2. Green "✓ On {provider} · {network} · ch. {n}" must be the top 
   badge / primary row — never below stream-only networks.

3. Stream-only pills (MLB.tv, Prime Video, regional stream) come AFTER 
   all linear + channel # options.

4. Apply in shared GameCard / watch-options component so Home + Ask 
   Finder + search stay consistent.

Test: Yanks sat → YES Network ch. 576 on Fios listed ABOVE 
NBC Sports California / MLB.tv pills.
```

**App Store:** Not a blocker — core UX polish post-approval.

---

## 📺 P1f — Watching / tracking UX sync (#18)

**Reported 2026-05-27:** User marked **"NOT LINKED"** — Mark as watching / Watching / Profile tracking / Movies Watching section don't feel connected.

**Four separate lists (keep distinct):**

| List | Storage | Action |
|------|---------|--------|
| ♥ Favorites | `favoriteShows` | Care about show — NOT same as Watching |
| 🔖 Save for later | `tunedtv:watchlist:v1` | Want to watch later |
| ▶ Watching | `tunedtv:tracking:v1` | In progress + S1E1, +1 episode |
| 👁 Mark watched | `tunedtv:watched:v1` | Finished — hide from For You |

**Should be ONE source of truth:** `tunedtv:tracking:v1` — title page **Watching**, favorites **Mark as watching** → **Watching**, Movies **Watching** section (big + small rows), Profile **TV & Movie tracking**.

**Bugs / polish:**

| Issue | Fix |
|-------|-----|
| Favorites still shows **Mark as watching** when already Watching elsewhere | Instant sync — show blue **Watching** everywhere |
| Same show in **big Watching card + small row** | Dedupe — one featured card OR compact list, not both |
| **Done / Want / Notify** vs **Mark watched** overlap | Clarify: Done/Mark watched → `watched:v1`; Want → watchlist; keep Watching = tracking only |
| **Games in Watchlist** (e.g. CIN @ NYM) mixed with shows | Split or label — sports bookmarks separate from show watchlist |
| Tap Watching on title page → favorites row doesn't update until refresh | Shared hook + re-render all surfaces on `tracking:v1` change |

**Copy-paste to Lovable (post-approval, after #13 or with Movies polish):**

```
Watching / tracking UX — single source of truth (tunedtv:tracking:v1):

1. Mark as watching (favorites tile), title page Watching button, and 
   Movies Watching section MUST read/write the same tracking store.

2. When a show is in tracking: ALL surfaces show blue "Watching" immediately 
   (no stale "Mark as watching" on favorites after tapping on title page).

3. Movies → Watching section: featured card OR compact list — do not 
   duplicate same title in big card AND small row.

4. Profile → TV & Movie tracking (+1 episode, trash) stays in sync with 
   Movies Watching section episode counts.

5. Keep separate: favoriteShows (♥), watchlist (🔖), watched (👁 Mark watched).
   Do not conflate Favorite with Watching.

6. Optional: remove sports games from show Watchlist or show under separate 
   "Saved games" if mixed today.

Test: Mark Shrinking as watching on title page → favorites shows Watching 
(not Mark as watching) → Profile shows S1E1 → Movies Watching section includes it.
Toggle off/remove in Profile → all surfaces update.
```

**App Store:** Not a blocker — localStorage tracking polish post-approval.

---

## 🏆 P1g — Leaderboard tally after vote (#19)

**Reported 2026-05-27:** User voted 👍/👎 on channel data; **Top tab score did not update**.

**Intended design:**
- Points for **signed-in** channel verification (thumbs only where **ch. #** is shown)
- `profiles.verification_count` drives leaderboard score
- Tiered points planned (+2 👍, +5 👎, +10 correction, +25 verified) — **may not all be wired**

**Likely bug (diagnose post-approval):**

| Check | If broken |
|-------|-----------|
| Vote inserts into `channel_feedback` | RLS or insert failing silently |
| `profiles.verification_count` increments on vote | **Missing trigger / RPC** — vote saved but score stays 0 |
| Leaderboard reads `verification_count` not raw feedback count | Query mismatch |
| Top tab refetches after vote | Stale cache — need invalidate + optimistic +1 |
| Duplicate vote within 24h | Updates row but doesn't double-count (expected) |

**Quick user checks (now):**
1. Signed in? (guest votes don't count on leaderboard)
2. Thumbs on a row **with channel number** (not stream-only badge)
3. Did you get a **"Thanks!"** toast after tap?
4. Force-quit app → Top tab again — still 0?

**Copy-paste to Lovable (post-approval):**

```
Leaderboard tally after channel vote:

1. After successful channel_feedback insert (vote ±1), increment 
   profiles.verification_count for auth.uid() (or apply tiered points 
   if that logic exists).

2. Top / Leaderboard tab must refetch or optimistically update the 
   current user's score immediately after vote.

3. Leaderboard query must ORDER BY verification_count (or points field) 
   — confirm it matches what gets incremented.

4. Show user's rank/score on Profile if not already.

Test: Sign in → thumbs up on "ESPN · ch. 570" → toast → Top tab shows 
score +1 within 2s without force-quit.
```

**App Store:** Not a blocker unless demo account can't demonstrate verification loop.

---

**Decision (2026-05-27):** Implement the **recommended** rules below (not optional variants).

**Schema today (`reviews` table):** `user_id`, `title_id`, `reaction`, `text` (≤300), `created_at`, `updated_at` — **no unique constraint** on `(user_id, title_id)`.

**Observed on My Shows favorites (2026-05-27):** Shrinking shows user's review inline **and** still shows **"+ Leave a review"** — likely allows duplicates; no visible **Edit**.

**User concern (2026-05-28):** If **every user review** for a title stacks on the **title card** / tile, it becomes a **messy log** — must not happen post-launch.

| Surface | What shows | What must NOT show |
|---------|------------|-------------------|
| **Favorites / list tile** | Aggregate (`92% · 12 reviews`) + **your** one-line review max | Full thread of all users' reviews |
| **Title detail page** | Full review list, **paginated** (5 + Load more) | Infinite scroll dump by default |
| **Title card in grids** | Poster, title, aggregate only | Any per-user review text stack |

| Rule | Implement |
|------|-----------|
| **One review per user per title** | `UNIQUE(user_id, title_id)` + upsert on submit |
| **Edit own review** | After reviewing → **"Edit your review"** (pre-filled form), not a second "+ Leave a review" |
| **Favorites list** | Aggregate only (`100% · N reviews`) + **your** one-line snippet; no full community thread under each tile |
| **Full reviews** | Title detail page only — paginate or "Load more" |

**Copy-paste to Lovable (post-approval, after Batch A + streaming cleanup):**

```
Title reviews UX — implement recommended rules:

1. UNIQUE(user_id, title_id) on reviews + upsert on submit (no duplicates).

2. If user already reviewed: show "Edit your review" not "+ Leave a review".

3. My Shows / favorites tiles: aggregate % + count only; show current user's 
   review in one line max; link "See all reviews" → title page.

4. Title page: full list, paginated (e.g. 5 + load more). Never render all reviews on list tiles or title cards.

5. Title cards / grid rows: aggregate % + count ONLY — no community review log.

Test: review Shrinking → Edit updates same row; second submit does not duplicate.
Test: 10 reviews on a title → tile shows "92% · 10 reviews" only; full list on title page paginated.
```

**App Store:** UGC declared in App Privacy — not a blocker.

---

## 🛡️ Admin / moderation (#14–#15)

### #14 — Grant admin (you — no Lovable publish)

```sql
INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR-UUID-HERE', 'admin');
```

Get UUID: Supabase → Authentication → Users. Then **`https://tunedtv.com/admin/feedback`**.

### #15 — Admin review moderation (Lovable, after #13)

**Today:** `/admin/feedback` exists for channel 👎 only. **Report** on title reviews has no admin queue.

**Copy-paste to Lovable:**

```
Admin moderation for title reviews:

1. review_reports table: reporter user_id, review_id, reason, created_at, status (open/resolved)

2. Wire existing "Report" on reviews → insert review_reports row (signed-in only)

3. /admin/reviews (admin role only, same gate as /admin/feedback):
   - List open reported reviews (newest first)
   - Actions: hide review (soft-delete flag), delete review, dismiss report
   - Show review text, title, username, report count

4. Users can delete own review from Edit screen (part of #13).

Test: report a review → appears in /admin/reviews → hide removes from public title page.
```

| Capability | Today | After #14–#15 |
|------------|-------|----------------|
| Channel 👎 queue | Built, needs admin grant | ✅ |
| Edit own review | ❌ | ✅ (#13) |
| Admin delete/hide reviews | ❌ (Supabase manual only) | ✅ (#15) |

---

## ⛔ Do NOT during App Store review

- Lovable publishes (except emergency: hard crash or demo login broken)
- Auth freeze paths: AppShell, login.tsx, NativeAuthBridge, Cloud Auth
- Fixes #1–#18 on the master list
- Delete `support@` demo account

**Exception:** #14 admin SQL in Supabase is fine anytime (no tunedtv.com deploy).

**If rejected:** fix only what Apple cites → resubmit. Web-only fixes need no new iOS build unless Apple asks.

**Emergency only (Waiting for Review + Finder completely dead):** BottomNav #1 alone — not full Batch A.

---

## ✅ Done & verified

| # | Item | Notes |
|---|------|-------|
| 1 | Thumbs require sign-in | Step 1 pass |
| 2 | `channel_feedback` metadata (ZIP, provider, DMA, network, channels, context, dedupe) | Step 2 pass |
| 3 | 👎 email → support@tunedtv.com | `channel_feedback_alert`, from noreply@notify.tunedtv.com — tested ESPN/Fios |
| 4 | Onboarding provider picker | Search, aliases, Popular near ZIP, A–Z, not listed |
| 5 | Provider-not-listed → support@ email | `provider_request_alert`; guest path via `/api/public/provider-request` |
| 6 | Email domain | notify.tunedtv.com verified (green dot) |
| 7 | Movies & Shows tab + sports-first Home | Step 6 built; tab order Finder→Movies→Alerts→Top→Profile; page title Movies & Shows |
| 8 | Admin feedback queue | `/admin/feedback` built — **SQL admin grant not run yet** |
| 9 | Google sign-in | Web + iOS app |
| 10 | Apple sign-in | iOS app (native bridge) |
| 11 | Onboarding skip trap fix | Sticky skip, Reset setup wipes prefs |
| 12 | Ask Finder: clear input after Go | User confirmed |
| 13 | Sign out clears localStorage | favorites, watchlist, tracking |
| 14 | **`getGames().catch`** on Sports loader | Shipped during review — empty games vs crash |
| 15 | iOS **1.0.9 (#19)** App Store submit | ASC App ID 6771259990, bundle `com.tunedtv.app` |
| 16 | Tab lag + cold start **diagnosed** | Lovable investigate-only; Batch A held for post-approval |

---

## 🔄 In progress

| # | Item | Status |
|---|------|--------|
| 14 | **Movies Hub v1** | ✅ Built |
| 15 | **Movies tab v1.1** | Built — **Publish + phone test pending** |
| 16 | **Hide Apple on web** | ✅ UA-only (`TunedTV-iOS`) — verified |

---

## 📋 Next up (priority order)

| # | Item | When |
|---|------|------|
| 16 | Test Movies Hub v1 on phone | After build + Update |
| 17 | Grant admin access (one-time SQL) | When ready to use `/admin/feedback` |
| 18 | Password reset email | Supabase/Lovable **auth emails** (not app emails) |
| 19 | User email: game tonight (opt-in) | After Movies Hub; tie to Game alerts toggle |
| 20 | User email: leaving soon (opt-in) | Tie to watchlist/favorites + Leaving soon toggle |
| 21 | Hide Apple sign-in on web browsers | ✅ Done (UA-only, not __tunedtvNativeAuth) |
| 22 | Web Apple OAuth fix | `invalid_client` / Cloud JWT — deferred |

---

## 🎬 Movies & Shows roadmap (from product vision)

| # | Item | Phase |
|---|------|-------|
| 23 | Search + ♥ + 🔖 on tiles | ✅ v1.1 — verify on phone |
| 24 | Unified Watchlist under My Shows | ✅ merged — verify |
| 25 | Mark watched → hide from For You | ✅ title page only |
| 26 | Sports tab, no movie search | ✅ verify |
| 27 | Bingeable shelf | Later — needs rules/data |
| 28 | Recommended for you (prefs) | Later |
| 29 | Because you watched (history) | Later |
| 30 | Continue watching / episode progress | Later |
| 31 | New episodes shelf + Alerts integration for favorite shows | Phase 8 |
| 32 | Hero affiliate banner on Movies & Shows | When sponsor/affiliate link ready |
| 33 | Cloud sync favorites/watchlist across devices | v1.1 — localStorage today |

---

## 🏈 Sports / data moat

| # | Item | Notes |
|---|------|-------|
| 34 | 👎 → email (done) | support@ inbox |
| 35 | Admin queue triage → apply to `provider_channel` | Built; needs admin grant + workflow habit |
| 36 | Expand provider channel data | Cox, Xfinity/Spectrum markets, etc. — ongoing |
| 37 | Duplicate 👎 clustering / priority | Later automation |
| 38 | Auto-apply channel fixes (careful) | Much later |

---

## 📱 Platform & launch

| # | Item | Notes |
|---|------|--------|
| 39 | iOS TestFlight ~1.0.8 | Native auth bridge |
| 40 | Android internal testing | Published |
| 41 | Safari / cross-browser test | Chrome tested; Safari checklist open |
| 42 | Email sign-up test (auto-confirm ON) | Assumed OK; optional quick incognito test |
| 43 | App Store / TestFlight polish | Screenshots, privacy, keywords — partial |
| 44 | Push notifications | v1.1+ — Alerts in-app only for now |
| 45 | Leaderboard username privacy | Shows email fragments — backlog |
| 46 | Resend for auth emails (password reset) | Mentioned repeatedly; not auth SMTP yet |

---

## ⏸️ Intentionally deferred

- **Pro / Event Pass / sub tracker** — strategy in [`docs/product-tiers-and-events.md`](product-tiers-and-events.md); build after #21 + World Cup hub v1
- **Desktop browser layout** — widen responsive layout on Mac Safari/Chrome (iPhone fine); post-approval polish, not review blocker
- **App icon redesign** — larger TV/play mark only, remove “TUNEDTV” text inside icon, thicker strokes; ship in **1.0.10** cosmetic build after approval (not during review)
- Hero banner / affiliate promo (no partner yet)
- Web Apple sign-in (hide on web instead)
- Big Ask Finder search overhauls (reverted; clear-on-Go only)
- Bingeable / ML recommendations
- Step 6b hero banner

---

## 🧪 Quick test scripts

**Movies Hub v1:** Sports search “Mets” (no movies) → Movies search “Shrinking” → ♥ and 🔖 → My Shows → Alerts.

**Provider onboarding:** Incognito → ZIP → search Verizon → Fios → finish.

**👎 ops:** Signed in → 👎 → support@ email → optional `/admin/feedback` after admin grant.

**Leaderboard #19 (post-fix):** Sign in → 👍 on row with **ch. ###** → toast → **Top** tab shows your score +1 without force-quit.

---

## 📎 Key contacts & infra

- Support inbox: support@tunedtv.com
- Sender: noreply@notify.tunedtv.com
- Live site: https://tunedtv.com
- Lovable prompts pack: `docs/lovable-prompts-may2026.md`
- Channel data pipeline: `docs/channel-data-pipeline.md`
- Product tiers & events: `docs/product-tiers-and-events.md`

---

## Admin grant (when ready)

```sql
INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR-UUID', 'admin');
```

Get UUID from Supabase Auth → Users or ask Lovable.
