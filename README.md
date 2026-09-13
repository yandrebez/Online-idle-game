# Nano Forge

An idle/incremental browser game, built to be monetised with ads.
Pure static HTML/CSS/JS — no build step, no server, no dependencies, no hosting bill.

**Play:** https://yandrebez.github.io/Online-idle-game/

© 2026 yandrebez. All rights reserved. This code is not licensed for reuse.

---

## Why this genre

Ad revenue = **sessions × time per session × ad slots per session**. Idle games win on
all three: players return several times a day, leave the tab open, and the genre has
long-established, non-annoying places to put a rewarded ad. Everything in here is built
around that:

| Feature | Why it earns |
|---|---|
| Offline earnings + "Double it" | The strongest rewarded-ad placement in the genre. Shown on almost every return visit. |
| Overdrive ×3 (rewarded) | Repeatable ad view, ~every 7 minutes of play, entirely opt-in. |
| Collapse with ×2 shards (rewarded) | High-value ad view at the exact moment a player most wants a bonus. |
| Daily bonus + streak | Drives the daily return that makes the offline ad fire again. |
| Sticky footer banner | Impressions the whole session, across every screen size. |
| 300×250 side rail | Desktop-only; highest-CPM display format. |
| Achievements, prestige, PWA install | Retention, which is what actually compounds revenue. |
| Service worker | Loads instantly on return visits; installable to a phone home screen. |

No ad is ever required to progress, and nothing asks a player to *click* an ad —
that is a ban, not a business.

---

## Turning on the money

I built and deployed the game, but I **cannot open ad accounts for you** — every network
needs your legal identity, address and payout details. That part is yours, and it's about
20 minutes of form-filling. Everything else is already wired up.

All of it happens in one file: [`js/ads-config.js`](js/ads-config.js).

### Step 1 — Monetag (5 minutes, instant approval, powers rewarded video)

This is the fastest path to a first dollar and the only one here that pays for
*rewarded* views.

1. Sign up at <https://monetag.com> → **Add site** → enter
   `yandrebez.github.io/Online-idle-game`.
2. Create a zone of type **Rewarded Interstitial**. Copy the numeric Zone ID.
3. Put it in `js/ads-config.js`:
   ```js
   monetag: {
     rewardedZone: '8765432',              // <- your zone id
     sdkDomain: 'vemtoutcheeg.com',        // <- the domain from your snippet
     interstitialZone: ''
   }
   ```
4. Commit and push. It's live in ~60 seconds.

### Step 2 — Adsterra (5 minutes, instant approval, fills the banner)

1. Sign up at <https://adsterra.com> → **Publisher** → add the same site.
2. Create a **Banner 728×90** unit and copy its key.
3. Fill in:
   ```js
   adsterra: { bannerKey: 'your-key-here', bannerWidth: 728, bannerHeight: 90 }
   ```

### Step 3 — AdSense (highest payout, needs approval, apply once traffic exists)

AdSense pays several times what the instant networks do, but it reviews the site by
hand and wants real visitors and real pages first. Apply after you have some traffic —
the privacy policy, `ads.txt` and content it looks for are already in this repo.

1. Apply at <https://adsense.google.com>.
2. Once approved, create two **Display** units (one responsive, one 300×250).
3. Fill in:
   ```js
   adsense: {
     client: 'ca-pub-XXXXXXXXXXXXXXXX',
     slots: { banner: '1234567890', rectangle: '0987654321' }
   }
   ```
4. Edit `ads.txt` in the repo root and uncomment the `google.com, pub-…` line with your
   publisher ID. **Skipping this costs you real money** — unverified inventory is bid
   down hard.

If both AdSense and Adsterra are configured, AdSense takes the footer banner and
Adsterra stands down; there is no double-serving.

### Step 4 — get players

The game earns nothing without traffic. Cheapest channels that work for idle games,
roughly in order of return:

- **r/incremental_games** — the genre's home. Read the rules, post a genuine
  "I made a thing" with a screenshot. One good post can be thousands of sessions.
- **itch.io** — free to list, has a built-in idle-game audience. Embed the Pages URL.
- **Free game portals** — Kongregate, Newgrounds, GameJolt, CrazyGames all take HTML5
  submissions at no cost.
- **Google** — `sitemap.xml`, `robots.txt`, OG tags and a fast mobile page are already
  in place. Submit the sitemap in Search Console.

---

## What the numbers realistically look like

Idle-game display CPMs sit around **$0.50–$3** depending on country mix; rewarded views
pay far better per impression but happen less often. A rough, honest sketch:

| Daily players | Plausible monthly revenue |
|---|---|
| 100 | a few dollars |
| 1,000 | $30 – $150 |
| 10,000 | $300 – $1,500 |

The game is the easy half. Traffic is the half that decides the outcome, and there is no
version of this that pays without it.

---

## Project layout

```
index.html          markup and ad slots
privacy.html        privacy policy (AdSense requires one; GDPR requires one)
css/style.css       all styling, responsive down to 320px
js/ads-config.js    >>> the only file you edit to enable ads <<<
js/ads.js           consent gate, banner injection, rewarded/interstitial API
js/data.js          generators, upgrades, shard shop, achievements (balance lives here)
js/game.js          economy, save/load, offline progress, prestige — no DOM
js/ui.js            rendering, input, the main loop
sw.js               service worker: instant repeat loads, offline play
ads.txt             authorised sellers — fill in after AdSense approval
.github/workflows/  auto-deploy to GitHub Pages on every push
```

`game.js` never touches the DOM and `ui.js` never touches the economy, so balance
changes and interface changes stay out of each other's way.

## Running it locally

No build, no install:

```bash
npx http-server -p 8080 .
# then open http://127.0.0.1:8080
```

## Tuning the game

Everything balance-related is in `js/data.js`. Costs follow the standard geometric
curve (×1.15 per purchase), which is what keeps every tier feeling relevant for roughly
the same stretch of play. If you want a faster or slower game, change `COST_GROWTH`
there — that single number sets the entire pacing.

Ad frequency lives under `behaviour` in `js/ads-config.js`: `interstitialCooldownSec`
sets the floor between interstitials, and `footerBanner` / `sideRail` switch the display
slots off entirely.
