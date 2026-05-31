# TunedTV — Product tiers, events & subscription strategy

Last updated: 2026-05-27  
Living doc — build on this as we ship.

---

## The genius (north star)

**Free for all:** user-verified channel finder — ZIP + provider → the right channel number, powered by the crowd.

**Why free stays generous:** every 👍/👎 grows the network, improves data, and builds trust. Gating core lookup would kill the flywheel.

**Then subs:** planning, personalization, event depth, and “what am I paying for?” — value on top of truth, not instead of it.

```
Free finder + verification → network & data moat → Pro / Event Pass revenue
```

---

## Free vs Pro — the line

| | **Free (always)** | **Pro / Event Pass (later)** |
|---|-------------------|------------------------------|
| **Job** | Where is it on *my* TV right now? | Don’t miss it; plan ahead; manage my watch life |
| **Sports** | Today + upcoming (7d), league filter, Ask Finder, 👍 verify, leaderboard | Event hubs, brackets, 14d lookahead, alert packs, multi-game planner |
| **Movies/Shows** | Discover, favorites, watchlist, basic tracking | My streaming stack, “on my subs” filter, release radar, sub ledger |
| **Revenue** | Affiliate sign-ups (FOX One, YouTube TV, etc.) | $4–8/mo Pro and/or per-event passes |

### Never gate (protect the moat)

- Channel numbers for today / near-term games  
- 👍/👎 verification and corrections  
- Basic search & Ask Finder  
- Leaderboard participation  
- Honest “Not on your services” when data is missing  

### Safe to gate (added value)

- Extended calendars & brackets  
- Personalized alerts (push)  
- Event hub depth  
- Subscription membership tracker  
- “Available on **my** services” filters  
- Multi-game / multi-channel planning views  

---

## Sports — upcoming UX (free, post-approval #21)

**Problem:** League filter shows “No matches” when nothing is on *today* but playoffs are tomorrow.

**Rule:** League filter = **this sport**, not **this sport today only**.

| Situation | Show |
|-----------|------|
| Games today in league | Live + today’s slate |
| No games today, games in 7d | **Upcoming {League}** — next 5–8 games |
| Playoffs detected | 14-day window + hero: “Next up: East Final — Thu 8pm TNT” |
| No games in window | “No NBA in the next 7 days” — don’t switch to all leagues silently |

**All Leagues (no filter):** Live now + on tonight + upcoming 48–72h (cap 6–10 games).

League chip badge optional: **NBA (2)** = 2 games in next 7 days.

---

## Event Hub template (Pro / Event Pass)

Reusable **`EventHub`** config — swap branding, dates, data source. One build, many events.

```
┌─────────────────────────────────────┐
│  🏆 {Event Name}                    │
│  Your teams: … · Next: …            │
├─────────────────────────────────────┤
│  TODAY · LIVE · UPCOMING            │
│  Schedule / bracket grid            │
│  Where to watch + YOUR ch. #        │
├─────────────────────────────────────┤
│  [Pro] Alerts · planner · sub needs │
└─────────────────────────────────────┘
```

| Tier | Hub access |
|------|------------|
| **Free** | Schedule, next games, channel on cards |
| **Event Pass or Pro** | Bracket, 14d calendar, alerts, multi-match planner, “services you need this week” |

---

## Event-specific depth

### FIFA World Cup 2026 (first hub — banner already live)

| Feature | Free | Pro / Pass |
|---------|------|------------|
| Match schedule by date | ✅ | ✅ |
| Group / knockout view | Basic list | Full bracket grid |
| Watch path (FOX / FS1 / Telemundo + ch. #) | ✅ | ✅ |
| English vs Spanish feed toggle | — | ✅ |
| “My country + favorites” filter | — | ✅ |
| Multi-match day planner | — | ✅ |
| Alerts (30 min, lineup, ET) | — | ✅ |
| Venue + local kickoff TZ | ✅ | ✅ |

**Event Pass idea:** ~$9.99 for World Cup window (Jun–Jul 2026) — converts casual fans who won’t pay year-round.

### NBA / NHL playoffs

| Feature | Free | Pro / Pass |
|---------|------|------------|
| Upcoming 7d | ✅ (#21) | — |
| Series view (Eastern Final G1–G7) | — | ✅ |
| 14-day lookahead | — | ✅ |
| Bracket “on now / next” | — | ✅ |
| RSN vs national explainer | Basic | Deep |
| Favorite team path through bracket | — | ✅ |
| Playoff alert pack (OT, G7) | — | ✅ |

**Event Pass idea:** ~$4.99 per round or full playoffs bundle.

### Olympics (2028 LA — design patterns now)

| Feature | Notes |
|---------|--------|
| Sport + day schedule | 40+ sports; NBC/Peacock complexity |
| Primetime vs live | US audience needs both |
| US / medal-focused filter | Optional |
| “Peacock + NBC + USA Network this week” | Links to sub tracker |
| Event Pass | Olympics month pricing |

### Super Bowl / one-night megas

- Single hero + countdown  
- Stream vs cable paths  
- Pregame / halftime channels (Pro nice-to-have)  
- Mostly free visibility; affiliate revenue on stream sign-ups  

---

## Movies & Shows — Pro pillar

Free = **discovery + lists** (`favoriteShows`, watchlist, `tracking:v1`, watched).

Pro = **“What am I paying for, and what’s worth watching on it?”**

### Tier 1 — streaming-aware discovery (uses TMDB / Watchmode)

| Feature | Description |
|---------|-------------|
| **My streaming stack** | User selects Netflix, Max, Prime, Apple TV+, Peacock, etc. |
| **“On my subs” filter** | Search/discover only titles available on services they pay for |
| **New this week on MY services** | Personalized release radar |
| **Leaving soon** on my services | Urgency without noise |
| **Watching hub** | `tracking:v1` as first-class Pro surface (sync #18) |

### Tier 2 — subscription membership tracker (later anchor)

Manual ledger first — no bank linking v1.

| Feature | Why |
|---------|-----|
| Sub ledger | Name, price, renewal date, cancel URL, shared w/ family |
| Monthly spend total | “$87/mo across 6 services” |
| Overlap detector | “Peacock + cable — World Cup mostly on FOX” |
| Event-driven ROI | “Keep Peacock through Olympics week?” |
| Trial reminders | FOX One 7-day trial for World Cup |
| Calendar export | Optional renewal reminders |

**Bridge to sports:** “For NBA Finals week you need ESPN + TNT; your profile has Max but not ESPN.”

### Tier 3 — social / habit (much later)

- Household shared watchlist  
- Binge planner (“finish Severance before S3”)  
- Recommendations beyond editorial lists  

---

## Packaging options

| Model | Pros | Cons |
|-------|------|------|
| **A — Pro only** ($5.99/mo / $49/yr) | Simple | Hard sell for one-off Cup fans |
| **B — Pro + Event Pass** | Cup/playoff fans convert | Two SKUs to maintain |
| **C — Affiliate-first, sub second** | Revenue before paywall maturity | Slower sub revenue |

**Recommended at our stage:** **B + C hybrid**

- Free: core finder + verification + 7d upcoming  
- **Event Pass:** World Cup, playoffs rounds  
- **Pro:** all events + sub tracker + alerts + 14d + movies “on my subs”  
- **Affiliate:** FOX One, YouTube TV, streaming trials on hubs  

---

## One-sentence pitch

**TunedTV:** free, crowd-verified channel finder for everyone. **TunedTV Pro:** what’s on, where it is on *your* TV, what you’re paying for, and what you can’t miss — especially during the World Cup and playoffs.

---

## Build order (after App Store + Batch A)

| Phase | Ship | Tier | Notes |
|-------|------|------|-------|
| **1** | Upcoming league UX | Free | Master todo **#21** |
| **2** | Leaderboard + auto-promote | Free | **#19**, **#20** — rewards verifiers |
| **3** | World Cup hub v1 | Free core | Aligns with existing banner |
| **4** | In-app alerts → push (v1.1) | Pro preview | Alerts tab foundation |
| **5** | My streaming services + “on my subs” | Pro | Movies foundation |
| **6** | Sub membership tracker | Pro | Manual ledger |
| **7** | Event Pass paywall on hub extras | Paid | Bracket, 14d, alert packs |
| **8** | Olympics hub | Reuse template | 2028 LA |

---

## Related docs

- Post-launch fixes: `docs/TunedTV-master-todo.md`  
- Channel data flywheel: `docs/channel-data-pipeline.md`  
- Lovable ops prompts: `docs/lovable-prompts-may2026.md`

---

## Open questions (fill in as we learn)

- [ ] Pro price point: $4.99 vs $5.99 vs $7.99/mo  
- [ ] Event Pass vs Pro bundle for World Cup  
- [ ] Apple IAP vs Stripe on web  
- [ ] Founding contributor perks vs Pro discount  
- [ ] Affiliate partners locked for Cup (FOX One, etc.)
