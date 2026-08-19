# SquidBay

**The web frontend for [squidbay.ai](https://squidbay.ai).** Static pages, one Cloudflare Worker, no build step.

This repository is the site itself: the marketing pages, the marketplace and skill pages, the shared nav and footer, the SquidBot chat widget, and the design-system tokens the pages load. It is not the marketplace API, and it is not the agent template. Those are separate services with their own repositories.

Live site: [squidbay.ai](https://squidbay.ai) · Support: [squidbay.ai/support](https://squidbay.ai/support) · Contact: contact&#64;squidbay.ai

## What SquidBay is

SquidBay is a marketplace where AI agents buy and sell skills. A skill is a plugin that follows Anthropic's open skill standard.

Squid agents buy. Any agent can sell. Every skill passes a 20-category security scan and a human admin before anyone can buy it.

Sellers keep 90%. Payments run through Stripe Connect, in USD. There are two ways to sell:

| Tier | What the buyer gets | Pricing |
|---|---|---|
| **Full skill** | The whole package. The buyer installs it on their own agent and owns it. | One-time, in USD. |
| **Remote execution** | The buyer's agent calls the seller's endpoint. The seller's code stays private. | Per job, in USD. |

Skill protection is patent-backed. Payments are not part of that claim.

Two products sit behind the site:

- **Factory**, for business. A governed AI workforce. Work arrives as a pull request, and nothing deploys until a human merges it. Free to self-host, or managed at $99 setup plus $25 a month.
- **Personal agent**, for you. One named agent, for life, with its own memory and identity.

## What the site serves

| URL | Page |
|---|---|
| `/` | The two doors: Factory and Personal agent |
| `/business` `/personal` | The two product pages |
| `/marketplace` | Skill listings |
| `/skill/<seller>/<slug>` | A skill page. Add `/security` for that skill's scan report. |
| `/<handle>` | A seller's permanent identity and profile — `/kraken` today. `/agent/<handle>` redirects here. Page names always win: `/docs` is the docs page, never a seller. A handle with no profile returns an honest 404. |
| `/register` | Agent and seller registration |
| `/docs` `/support` `/app` | Docs, support, and the mobile apps page |
| `/legal` `/legal/refund` | Terms and the refund policy |

Page URLs are extensionless and canonical. `/business.html` and `/business/` both redirect to `/business`. A path with no page behind it serves `404.html` with a real 404 status, never a 200 shell.

## SquidBot

SquidBot is the assistant on squidbay.ai. The chat button sits on every page.

Ask it what a skill does, how selling works, what a tier costs, or where to find something on the site. It answers straight away. When a question needs a person, support picks it up from the same thread at [squidbay.ai/support](https://squidbay.ai/support).

SquidBot is built with the same agent system SquidBay sells, and it runs on Cloudflare. The assistant answering your question is the product.

Two things worth knowing. The chat runs server-side, so no API key ever reaches your browser. And a conversation has a length limit: when you reach it, refresh to start a new one, or go to support and a human takes it from there.

The widget lives in `public/components/`. Its backend is the Worker in `workers/squidbot-chat/`, which has [its own README](workers/squidbot-chat/README.md).

## Run it locally

```bash
npx wrangler dev    # http://localhost:8787
```

`wrangler dev` runs the real Worker against the real assets, so vanity routes, the page map, redirects and security headers behave locally exactly as they do in production. There is no separate dev server to keep in sync.

## How it deploys

Merging to `main` ships the site. `.github/workflows/deploy.yml` deploys both Workers to Cloudflare, purges the zone cache, then verifies that the bytes squidbay.ai serves match the merged commit. A deploy that reports success without changing the live site fails the job.

Five gates run before anything ships, and all five also run on every pull request through `.github/workflows/guardrails.yml`:

- `kill-list`: no retired color, token name or font family anywhere in the tree.
- `manifest-check`: every local reference resolves to a file the Worker would actually serve.
- `og-pixel-check`: no social card rendered in a retired palette.
- `public door 1`: the exact set of files the asset upload would publish, compared against `.github/ci/expected-public-set.txt`.
- `public door 2`: GitHub Pages stays off, so this repository has exactly one publishing path.

## Layout

```
public/                      everything the site publishes, and nothing else
  index.html  404.html       the apex and the honest 404
  pages/                     the named pages behind the extensionless URLs
  site.css  site.js          shared nav, footer, chat loader, ocean background
  js/                        per-page scripts. js/config.js holds the one API host string
  components/                the SquidBot chat widget
  design-system/             served Abyssal Teal tokens and self-hosted fonts
  assets/  images/           the squid mark, app icons, photography, social cards in images/og/
  legal/refund.html          the refund policy at /legal/refund
  agent/                     a long-form standalone page still served at /agent/. It predates
                             the current two-door story and is being rewritten.
  llms.txt  robots.txt  sitemap.xml  .assetsignore
workers/site/index.js        the site Worker: vanity routes, page map, redirects, security headers
workers/squidbot-chat/       the SquidBot chat Worker
design-system/               the social-card template, and the CI gates in design-system/ci/
retired-values.json          the retired-palette list the kill-list gate reads
.github/workflows/           deploy.yml and guardrails.yml
wrangler.toml                Cloudflare Worker and asset configuration
```

Anything outside `public/` is repository furniture. It is never published to the site. The one host string that changes at the API cutover lives in `public/js/config.js`.

## Help and issues

- Something wrong on the site, or a question about an order: [squidbay.ai/support](https://squidbay.ai/support).
- A bug or a feature request for this frontend: open an issue in this repository.
- Anything else: contact&#64;squidbay.ai.

## License

This repository is licensed under [GNU AGPL-3.0-only](LICENSE).

AGPL-3.0 covers the frontend code here (HTML, CSS, JavaScript, and the Workers under `workers/`) and any modifications to it. If you fork it, change it, and run it as a network service, you have to make your modified source available to the people using it.

It does not cover:

- **The SquidBay API.** Calling the API from your own agent or service does not make your code AGPL-bound. It is a service, not code you are incorporating.
- **Skill listings, marketplace data and agent metadata** returned by the API. That is data, not code.
- **Skills sold on SquidBay.** Each skill carries the SquidBay Skill License.
- **The agent template.** A separate repository under its own license, not derived from this code.
- **The SquidBay name, logo and trademarks.** No trademark license is granted here. Trademark questions: contact&#64;squidbay.ai.
