# Launch kit

Ready-to-use copy for getting players. The game earns nothing without traffic,
and these are the free channels that actually work for idle games.

Everything below is a draft in your voice — read it once and change anything
that doesn't sound like you. Posts that read as copy-paste marketing get
downvoted; posts that read like a person sharing a thing they made do well.

**Your link:** https://yandrebez.github.io/Online-idle-game/

---

## 1. Reddit — r/incremental_games

The genre's home and the single highest-return post you can make. **Read the
sidebar and pinned rules before posting** — subreddits vary on self-promotion
days, flair requirements and whether links go in the post or a comment. Follow
whatever it says there over anything here.

**Title**

> I made Nano Forge, a small idle game about building nanobot factories — no ads required to progress, feedback welcome

**Body**

> I've been building a browser idle game called **Nano Forge** and it's finally
> in a state worth showing.
>
> You forge matter by hand, buy generators that do it for you, and eventually
> collapse the whole run for Singularity Shards that make the next one faster.
> Ten generator tiers, eighteen upgrades, a permanent shard shop, offline
> earnings and twenty-four awards.
>
> Play it here (free, no install, works on phones): <link>
>
> A few things I cared about:
> - **Offline progress** — it keeps earning while the tab is closed.
> - **No paywall and no forced ads.** There are optional rewarded bonuses, but
>   nothing in the game is gated behind watching one.
> - **Your save is yours** — it lives in your browser, and there's an
>   export/import code in the settings so you can move it or back it up.
>
> It's my first idle game, so I'd genuinely like to know: does the early game
> drag? Is the first Collapse too far away? Anything that felt bad, I want to
> hear it.

**After posting:** reply to every comment for the first few hours. Engagement
is what keeps the post visible, and early feedback is how the balance gets
fixed.

---

## 2. itch.io

Free to list, and has a built-in idle-game audience that browses by tag.

- **Kind of project:** HTML
- **Embed:** point it at `https://yandrebez.github.io/Online-idle-game/` — or
  upload a zip of the repo and let itch host it; both work.
- **Tags:** `idle`, `incremental`, `clicker`, `html5`, `browser`, `management`,
  `singleplayer`
- **Cover image:** use `assets/og.png` from the repo.

**Short description**

> Build nanobot factories, automate everything, then collapse reality for
> permanent bonuses. A free idle game that keeps earning while you're away.

**Long description**

> **Nano Forge** is an idle factory game you can play in a browser tab.
>
> Start by forging matter one click at a time. Buy a Nano Scrapper so you don't
> have to. Then a Drone Swarm, an Arc Smelter, a Fusion Plant, and eventually a
> Singularity Core that turns matter into more matter faster than you can watch.
>
> When a run has given you everything it can, **Collapse** it — trade the whole
> factory for Singularity Shards that make every future run permanently
> stronger, and spend them on autonomous arms, denser reality and longer offline
> storage.
>
> - Ten generator tiers with milestone bonuses
> - Eighteen upgrades that multiply production
> - Prestige system with a permanent shard shop
> - Offline earnings — it runs while the tab is closed
> - Twenty-four awards, each one a permanent boost
> - Saves to your browser, with export/import codes
> - Installable to your phone's home screen
>
> Free, no account, no install.

---

## 3. HTML5 game portals

All free to submit. Each one is a separate audience, so do all of them.

| Portal | Notes |
|---|---|
| Newgrounds | Submit as an HTML5 game. Active, opinionated audience. |
| GameJolt | Free listing, good discovery for small indie games. |
| Kongregate | Long-standing idle-game community. |
| CrazyGames | Has a developer submission form; larger traffic if accepted. |
| itch.io | Covered above — do this one first. |

Reuse the itch.io description for all of them.

---

## 4. Google Search Console

`robots.txt`, `sitemap.xml`, the OG tags and a fast mobile page are already in
the repo, so this is just telling Google the site exists.

1. Go to <https://search.google.com/search-console>.
2. Add a **URL prefix** property: `https://yandrebez.github.io/Online-idle-game/`
3. Verify with the **HTML tag** method — it gives you a `<meta name="google-site-verification" ...>`
   tag. Paste it into the `<head>` of `index.html`, push, then click Verify.
4. Under **Sitemaps**, submit: `sitemap.xml`
5. Indexing takes days to weeks. Nothing more to do after this.

---

## 5. What to expect

Be realistic about the shape of this. A good r/incremental_games post might
bring a few thousand sessions over a week, and most of those people never come
back. What matters is the fraction that do — which is why the daily bonus,
streak and offline earnings exist.

Revenue follows retained daily players, not launch-day spikes:

| Daily players | Plausible monthly revenue |
|---|---|
| 100 | a few dollars |
| 1,000 | $30 – $150 |
| 10,000 | $300 – $1,500 |

The honest path from here is: post it, read the feedback, fix whatever people
say feels bad, post the update. Idle games grow by iteration, not by launch.
