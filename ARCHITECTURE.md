# Architecture — how squidbay.ai works

squidbay.ai is a **static site** — plain HTML/CSS/JS, no framework — served by a **single
Cloudflare Worker** sitting in front of **Workers Static Assets**. This is the map: the pieces,
and how a request and a deploy actually flow. Every fact here is load-bearing; the callouts mark
the ones that will bite if you forget them.

## Request flow

```
browser ──▶ Cloudflare edge ──▶ Worker: workers/site/index.js   [run_worker_first = true]
                                     │
                 ┌───────────────────┴────────────────────────┐
          vanity route?                                  everything else
                 │                                              │
                 ▼                                              ▼
   rewrite to a real asset file:                    env.ASSETS.fetch(request)
   /skill/<seller>/<slug>          → skill.html      → serve the matching file (200),
   /skill/<seller>/<slug>/security → security-report   or 404.html WITH a 404 status
   /agent/kraken                   → seller.html
                 │
                 ▼
   Workers Static Assets serves the file; the Worker stamps the response `no-store`
```

> **⚠ Load-bearing: `run_worker_first = true`.** Cloudflare's default flag
> `assets_navigation_prefers_asset_serving` (on for any `compatibility_date ≥ 2025-04-01`) makes a
> **browser navigation** (a request carrying `Sec-Fetch-Mode: navigate`) get answered by
> asset-serving — and receive `404.html` for a path with no file — **before the Worker ever runs**.
> `curl`/fetch/monitoring don't send that header, so they reach the Worker and see 200. Only
> `run_worker_first = true` (the boolean, **not** a path array) makes the Worker run first for
> navigations. And it must be shipped by **wrangler ≥ 4.20** — older wrangler silently drops the
> field as "unexpected." That's why the deploy pins `wranglerVersion: '4.123.0'`.

## The vanity routes (the Worker's entire job)

| URL | Served from | Notes |
|---|---|---|
| `/skill/<seller>/<slug>` | `skill.html` | the page looks itself up in `skills-data.js` by `handle`+`slug` |
| `/skill/<seller>/<slug>/security` | `security-report.html` | derives its title, seller, and back-link from the URL |
| `/agent/kraken` | `seller.html` | only kraken has a demo profile; every other `/agent/*` is an honest 404 |
| anything else | the matching file, or `404.html` | plain static assets, unchanged |

Anything the Worker doesn't claim is handed straight back via `env.ASSETS.fetch(request)`, so the
`agent/` folder and every real asset are served exactly as before, and a genuine miss still gets
`404.html` with a 404 status.

## The catalog

`skills-data.js` (`window.SB_SKILLS`) is the **single source** of the marketplace catalog — the demo
skills and their pricing/ratings/reviews. `skill.html`, `marketplace.html`, and `seller.html` all read
it. A skill's `handle` + `slug` **are** its vanity URL: `/skill/<handle>/<slug>`. Add a skill by
adding an entry here (and, for a seller profile card, a card in `seller.html`).

## Assets config — wrangler.toml

- `directory = "."` — the repo root is the asset root.
- `html_handling = "auto-trailing-slash"` — `/foo` serves `foo.html`; `/foo.html` 307s to `/foo`.
- `not_found_handling = "404-page"` — an unmatched path serves `404.html` **with a 404 status**.
- `run_worker_first = true` — see the callout above.
- The apex→Worker binding lives in the **Cloudflare dashboard**, deliberately not in `routes` here, so
  a deploy can never repoint the live domain.

## Deploy — "merge = ship", in two lanes

```
git push origin main
  ├─ Cloudflare Pages (pages-build-deployment) ──▶ ships HTML/CSS/JS ASSETS
  └─ .github/workflows/deploy.yml  (deploy job) ──▶ ships the WORKER + assets config
        design gates ──▶ wrangler deploy ──▶ purge cache ──▶ verify live
        kill-list        wrangler 4.123.0     zone purge      sha(live site.js)
        manifest-check   (config + script)    (token needs    == sha(commit)
        og-pixel-check                         Zone:Cache Purge)
  + guardrails.yml runs its own independent checks
```

> **⚠ Three things that bite if forgotten:**
> 1. **Two separate lanes.** Assets ship via Pages; the Worker ships via `deploy.yml`. A failed design
>    gate fails the Worker deploy while assets keep shipping — so the site can *look* updated while the
>    Worker is frozen at an old version. When something's off, check the **`deploy`** run, not just Pages,
>    and confirm the live Worker with `workers_get_worker_code` (script `squidbay-ai-preview`).
> 2. **wrangler version.** An out-of-date wrangler silently drops newer `[assets]` config. Keep the pin
>    at ≥ 4.20; watch the deploy log for `Unexpected fields found in assets field`.
> 3. **Verify like a human.** The deploy purges the zone so browsers get fresh pages. Confirm with a
>    **real browser navigation** (`-H 'sec-fetch-mode: navigate'`) or actual clicks — plain `curl` hides
>    the entire class of navigation-only bugs.

## The demo flow (the clickable wiring diagram)

```
/ (landing) ──card──▶ /skill/kraken/text-translation
      └─ seller "kraken" (gold) ──▶ /agent/kraken  ──▶ 3 skill cards ──▶ each skill page
/marketplace ──card──▶ skill page ;  seller "kraken" ──▶ /agent/kraken
skill page ──"Security report"──▶ /skill/<h>/<slug>/security ──"Back to skill"──▶ that same skill
```

Only **kraken** is a live agent profile — it's the demo agent. Other seller names render as plain
text (no dead links). These placeholder pages are the visual wiring for the real buy-flow plumbing
still to come — keep them coherent until plumbing makes them real.

## Design system + CI gates

- **Abyssal Teal** tokens live in `design-system/` and `site.css` (`var(--...)`). Teal `#46C4C4` is the
  accent; gold `--yellow` marks the clickable **agent identity** (seller names → `/agent/<handle>`).
- **Gates** (each can block the deploy):
  - `design-system/ci/kill-list.mjs` — banned patterns.
  - `design-system/ci/manifest-check.mjs` — every internal link resolves (it knows the Worker's vanity
    routes, so `/skill/<seller>/<slug>` isn't flagged as a dead link).
  - `design-system/ci/og-pixel-check.mjs` — share-image integrity.
