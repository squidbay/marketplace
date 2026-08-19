// The SITE Worker's script — the vanity skill/agent routes, the page-map, and nothing else.
//
// Until this file existed, squidbay.ai was assets-only: wrangler.toml declared
// [assets] with no `main`, so every request was answered by Workers Static Assets
// directly and no code of ours ever ran. That is why
// https://squidbay.ai/skill/codekraken/pull-request-review served the 404 page —
// there is no such file on disk, and there was nothing to rewrite it to one.
//
// This script is that rewrite. It is deliberately the smallest program that can do
// the job: no dependencies, no imports, no state, no config of its own.
//
//   /<handle>                        → the seller identity + profile page
//   /agent/<handle>                  → 301 to /<handle>
//   /skill/<seller>/<slug>/security  → the security-report page
//   /skill/<seller>/<slug>           → the skill page
//   /agent  and  /agent/             → 301 to /personal (the agent page is gone)
//   /<one of the 8 page names>       → pages/<name> if it exists, else <name> at the root
//   /<name>.html  and  /<name>/      → 301 to /<name>, the one canonical URL
//   /pages/<anything>                → 301 to the extensionless root URL
//   anything else                    → handed straight back to the asset server
//
// Three details are load-bearing, so nobody has to rediscover them the hard way:
//
// 1. It asks the asset binding for the EXTENSIONLESS path (`/skill`), never
//    `/skill.html`. wrangler.toml sets html_handling = "auto-trailing-slash", under
//    which `/foo.html` is answered with a 307 to `/foo`. Fetching `/skill.html` here
//    would hand the visitor a redirect instead of a page; fetching `/skill` serves
//    skill.html with a 200, which is the whole point.
//
// 2. It STRIPS the `Sec-Fetch-*` request headers before calling the asset binding.
//    This one cost hours. Every real browser navigation sends `Sec-Fetch-Mode:
//    navigate`; curl, WebFetch, and monitoring do not. When env.ASSETS.fetch() sees
//    that header, Workers Static Assets treats the subrequest as a top-level
//    navigation and applies not_found_handling — returning 404.html WITH a 404 even
//    for `/skill`, which exists. The result: these routes 404'd for every human and
//    200'd for every check, which reads exactly like a phantom cache bug. Rebuilding
//    the subrequest without the navigation headers makes the asset resolve normally.
//    (Verified against the live site: `-H 'sec-fetch-mode: navigate'` → 404, same
//    request without it → 200.)
//
// 3. The final `env.ASSETS.fetch(request)` is a real passthrough. It preserves
//    not_found_handling = "404-page": a path that matches no asset still gets 404.html
//    WITH a 404 status. A genuine 404 must stay a 404 — but it is marked no-store so a
//    cached 404 can never pin itself to a path that later becomes valid.
//
// wrangler.toml sets `run_worker_first = true` — not a list of route patterns — so this
// script runs before the asset server on EVERY request. The array form was tried first and
// does not work: it leaves `assets_navigation_prefers_asset_serving` in effect, and that
// flag answers navigation requests (`Sec-Fetch-Mode: navigate`, i.e. every real browser
// hit) from the asset-serving logic BEFORE the Worker is invoked — so a path with no file
// behind it served 404.html to humans while curl, which sends no such header, reached the
// Worker and got a 200. Only `true` disables the flag. wrangler.toml's own comment carries
// the full account; the consequence for this file is that every path below is reachable,
// including for browser navigations, and anything not claimed here is handed straight back
// to the asset server by the passthrough at the bottom.

// The pages that live at the URL root today and move into pages/ later. The URL a visitor
// types NEVER changes — this map is what makes the file location and the URL independent,
// so the files can move in a separate change without a single live URL moving with them.
//
// Read the fetch handler's page-map block for how it is used. The short version: on
// `/<name>` the Worker asks the asset server for `/pages/<name>` first and falls back to
// `/<name>` at the root, so the SAME code is correct both before the files move and after.
// That is deliberate — the assets and the Worker deploy on two different lanes and can ship
// minutes apart, and a visitor must see a working page at every point in between.
const PAGES = new Set([
  "app",
  "business",
  "docs",
  "legal",
  "marketplace",
  "personal",
  "register",
  "support",
  // The three template pages the vanity routes rewrite to. They are in this set for a
  // reason that is easy to miss: /skill, /seller and /security-report are not only rewrite
  // TARGETS, they are live URLs a visitor can type, and sitemap.xml lists all three. The
  // rewrites alone would keep /skill/<seller>/<slug> working while the three direct URLs
  // 404'd the moment their files moved. Being in this set is also what gives them their
  // .html and trailing-slash 301s and the /pages/* guard, exactly like the other eight.
  "skill",
  "seller",
  "security-report",
]);

// ── The seller identity ──────────────────────────────────────────────────────────────
//
// A seller's address is `squidbay.ai/<handle>` — at the root, alongside the page names, not
// under a folder. The registered map (business/SQUIDBAY-GROUNDING-THE-ABYSS.md §The
// addresses) is where that comes from: the handle IS the identity, permanent and immutable,
// so it gets the shortest URL the site has. `/agent/<handle>` is a serving route rather than
// an address, and it forwards here.
//
// The shape is deliberately narrow: lowercase letters, digits and hyphens, first and last
// character alphanumeric, 32 characters at most. NO DOT is the load-bearing part — it is what
// keeps a filename from ever being read as a handle, and it is why `/agent/index.html` still
// reaches the bare-shape 301 further down instead of being forwarded to `/index.html`.
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

// The handles that have a profile page today.
//
// One entry, and that is the honest state of the site: `pages/seller.html` is kraken's
// profile, written out rather than generated, so kraken is the only handle there is a page
// for. Every other handle is an honest 404 — a seller name links somewhere only when there
// is somewhere to land. When profiles become real, this set is what grows.
const HANDLES = new Set(["kraken"]);

// Names a handle may never take, so a page can never be shadowed by a seller.
//
// DERIVED FROM THE TREE, not from memory. Three sources, each of which is a URL the site
// already answers at the first path segment:
//
//   1. every entry the asset root serves at the root level — `ls public/`
//   2. every page under `public/pages/` — which is PAGES, spread in below
//   3. every first segment the Worker already claims — `agent` and `skill`
//
// PAGES is spread in rather than copied so that adding a page reserves its name in the same
// edit. ROOT_NAMES is the list that has to be re-derived by hand when the asset root gains a
// root-level entry, and it carries both spellings of the two .html files, because
// html_handling serves `404.html` at `/404` as well.
//
// This runs BEFORE the handle route, never after: a reserved name is answered by the blocks
// that own it and never reaches the seller lookup. That ordering is the whole guarantee, and
// it is what "page names take precedence" means mechanically.
const ROOT_NAMES = [
  "404",
  "404.html",
  "assets",
  "components",
  "design-system",
  "favicon.ico",
  "favicon.svg",
  "images",
  "index",
  "index.html",
  "js",
  "legal",
  "llms.txt",
  "pages",
  "robots.txt",
  "site.css",
  "site.js",
  "sitemap.xml",
  "skills-data.js",
];
const RESERVED = new Set([...PAGES, ...ROOT_NAMES, "agent", "skill"]);

// URLs that once served their own file and now point at the canonical one.
//
// `/legal-refund` and `/legal/refund` were byte-identical twins — the same 2678-byte
// refunds page reachable at two URLs. Everything that actually links to it already used
// `/legal/refund`: sitemap.xml, the card on the legal page, the footer nav in site.js,
// and — the tell — the canonical link tag inside legal-refund.html itself. So the flat
// file was the accident, and it has been deleted. This keeps its URL working.
//
// `/agent` is the second entry, and it is retired for a different reason: the page it
// served is deleted, not duplicated. `public/agent/` was a 1557-line standalone microsite
// with its own CSS and JS, superseded by `/personal`, and it was removed file-by-file in
// the PR this line ships with. Its URL keeps answering — to `/personal`, the page that now
// tells that story — because the marketplace grid, the index grid and years of outbound
// links all point into `/agent`, and a deleted page whose URL 404s is a break, not a
// cleanup.
//
// EXACT PATH ONLY. `/agent/<handle>` is its own route — a 301 to `/<handle>`, the canon
// address — and is matched higher up in the router, before this block is reached. That
// ordering is load-bearing, and the rehearsal matrix in the PR proves it: `/agent/kraken`
// 301s to `/kraken`, `/agent` 301s to `/personal`, and the two never cross.
//
// A retired URL never just 404s. Someone out there has the old link.
const RETIRED_URLS = new Map([
  ["/legal-refund", "/legal/refund"],
  ["/agent", "/personal"],
]);

// A subrequest to the asset binding for `path`, carrying the visitor's headers MINUS
// the navigation markers that would make Static Assets serve the 404 page (see note 2).
function assetRequest(path, url, request) {
  const headers = new Headers(request.headers);
  headers.delete("Sec-Fetch-Mode");
  headers.delete("Sec-Fetch-Dest");
  headers.delete("Sec-Fetch-Site");
  headers.delete("Sec-Fetch-User");
  return new Request(new URL(path, url), { method: "GET", headers });
}

// Mark a response uncacheable. `no-store` makes Cloudflare BYPASS the cache — the
// response is never stored and this Worker runs on every request — so a stale status
// (e.g. a 404 from before a route existed) can never be pinned to one of these paths.
function noStore(response) {
  const r = new Response(response.body, response);
  r.headers.set("Cache-Control", "no-store");
  return r;
}

// Serve a mapped page BY NAME, wherever its file currently lives: ask the asset server for
// `pages/<name>` and fall back to `/<name>` at the root.
//
// Every route that serves a page goes through here — the page-map and all three vanity
// rewrites — so no caller has to know where the file sits. That is what keeps this Worker
// correct on BOTH sides of a file move, and it is not a theoretical nicety: assets and the
// Worker deploy on two different lanes that can land minutes apart. A rewrite pointed
// straight at `/pages/skill` would 404 every vanity URL in the window where the Worker has
// shipped and the moved files have not — or the reverse. With the fallback there is no
// window, and the same code is correct before, during and after.
//
// The 404 test is what makes it work: with the navigation headers stripped (note 2) a real
// asset resolves 200 and a missing one is an honest 404, so a 404 here means "not moved
// yet", never "broken". `env.ASSETS.fetch` is a subrequest straight to the asset server, so
// neither call re-enters this Worker and no loop is possible.
async function servePage(name, url, request, env) {
  const moved = await env.ASSETS.fetch(assetRequest(`/pages/${name}`, url, request));
  if (moved.status !== 404) return noStore(moved);
  return noStore(await env.ASSETS.fetch(assetRequest(`/${name}`, url, request)));
}

// ── The security headers ─────────────────────────────────────────────────────────────
//
// These used to be set by server.js, an Express app with `helmet`, back when a Node
// process served this site. That process has not answered a real request since the site
// moved to Cloudflare — so from the move until now, the site has been shipping NO
// security headers at all. Deleting server.js without moving the policy here would have
// made a silent gap permanent instead of closing it.
//
// The CSP is NOT a copy of the Express one. It was rebuilt from what the pages actually
// load today, measured rather than assumed, and that changed it in both directions:
//
//   ADDED   https://squidbot-chat.andrew-415.workers.dev — the chat widget's backend.
//           components/chatbot.js fetches it on every page. The Express policy predates
//           the widget's move to a Worker and does not list it, so the old policy would
//           have broken chat the moment it was enforced.
//   DROPPED https://squidbay-api-production.up.railway.app — nothing references it.
//   DROPPED https://cdnjs.cloudflare.com and the Google Fonts origins — no page loads a
//           script from a CDN, and both faces are self-hosted in design-system/fonts/.
//   KEPT    api.squidbay.io — js/config.js names it as THE api host and four scripts
//           call it. It stays .io until that record moves; this is not the cutover.
//   KEPT    the two Cloudflare Insights origins. The beacon appears in no source file
//           because Cloudflare injects it at the edge — grep the repo and you will
//           conclude it is unused, which is exactly the wrong conclusion.
//
// 'unsafe-inline' is in script-src and script-src-attr because seven shipped pages carry
// inline <script> blocks and there are eight inline handlers (7 onclick, 1 onsubmit).
// Removing it is a real cleanup, but it is a page change, not a header change, and doing
// it here would break those pages on merge.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.squidbay.io https://squidbot-chat.andrew-415.workers.dev https://cloudflareinsights.com",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
};

// Apply the policy to documents only.
//
// Only HTML gets these headers: a CSP on site.css does nothing, and X-Frame-Options on an
// image is noise. Content-type is the test rather than the route, so every document is
// covered by construction — the eight mapped pages, the skill/seller/security-report
// rewrites, the apex, legal/refund.html, AND 404.html, which is a real page a real person
// reads. Redirects are skipped: they carry no document, and the Response that
// `Response.redirect()` returns is immutable, so touching its headers would throw.
function withSecurityHeaders(response) {
  if (!/^text\/html/i.test(response.headers.get("Content-Type") || "")) return response;
  const r = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) r.headers.set(name, value);
  return r;
}

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await route(request, env));
  },
};

// The router. Unchanged by the header work above — it is wrapped, not edited, so the
// policy lives in exactly one place and no route can forget it.
async function route(request, env) {
    const url = new URL(request.url);

    // "/skill/codekraken/pull-request-review/" → ["skill","codekraken","pull-request-review"]
    const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

    if (segments[0] === "skill") {
      if (segments.length === 4 && segments[3] === "security") {
        return servePage("security-report", url, request, env);
      }
      if (segments.length === 3) {
        return servePage("skill", url, request, env);
      }
    }

    // /agent/<handle> → 301 to /<handle>. The serving route dies and forwards in the same
    // commit, so there is no window where a profile goes dark and no old link breaks: the
    // marketplace grid, the index grid, both skill pages and years of outbound links all
    // point into /agent/<handle>.
    //
    // The WHOLE shape forwards, not just the handles that have a page. `/agent/nobody` lands
    // on `/nobody` and gets its honest 404 there — the address moved, and whether a handle
    // exists is a question the new address answers. A retired URL never just 404s.
    //
    // The HANDLE shape is what keeps this block off `/agent/index.html`: that segment has a
    // dot, so it is not a handle, and it falls through to the bare-shape 301 below where it
    // belongs. `/agent` and `/agent/` never reach here at all — they are one segment.
    if (segments[0] === "agent" && segments.length === 2 && HANDLE.test(segments[1])) {
      const canonical = new URL(`/${segments[1]}`, url);
      canonical.search = url.search;
      return Response.redirect(canonical.toString(), 301);
    }

    // The page-map. `url.pathname` is matched WHOLE and extensionless — `/business` serves,
    // while `/business.html` and `/business/` redirect to it in the block below. Exactly one
    // of the three answers 200; the other two point at it. That is the whole URL contract.
    const pageName = url.pathname.slice(1);
    if (PAGES.has(pageName)) {
      return servePage(pageName, url, request, env);
    }

    // The `.html` and trailing-slash forms of those same 8 names, 301'd to the canonical
    // extensionless URL.
    //
    // These two shapes answer correctly TODAY without any help from this Worker:
    // html_handling = "auto-trailing-slash" 307s `/business.html` and `/business/` to
    // `/business`. But that only works while `business.html` sits at the URL root — it is the
    // asset server redirecting a request for a file it can see. Once the file moves into
    // pages/, there is nothing at the root to redirect FROM, and both shapes become honest
    // 404s. Measured, not predicted: a dev run against a tree with the pages already moved
    // returned 404 for `/business.html`, `/business/` and `/legal/`.
    //
    // So the Worker takes ownership of the redirect before the move removes it. Nothing
    // changes for visitors today (307 → 301 to the same place); the difference only shows up
    // on the far side of the move, which is precisely when it would otherwise break. 301
    // rather than 307 because a name's canonical URL is a permanent fact, not a temporary one.
    // `/agent/index.html` is stripped too. A deleted DIRECTORY has three public shapes, not
    // two — `/agent`, `/agent/` and the index file people bookmarked from the address bar —
    // and while the folder existed the asset server 307'd the third to the second for free.
    // It cannot any more: html_handling can only redirect for a file it can still see, which
    // is the same lesson the `.html` strip above exists for. Stripping it here is what makes
    // all three shapes normalise to one name for both blocks below.
    const canonicalName = pageName
      .replace(/\/index\.html$/, "")
      .replace(/\/$/, "")
      .replace(/\.html$/, "");
    if (canonicalName !== pageName && PAGES.has(canonicalName)) {
      const canonical = new URL(`/${canonicalName}`, url);
      canonical.search = url.search;
      return Response.redirect(canonical.toString(), 301);
    }

    // Retired URLs → their canonical twin. The path is normalised the same way as the
    // block above — trailing slash and `.html` stripped — so `/legal-refund`,
    // `/legal-refund/` and `/legal-refund.html` all land in the same place. That matters
    // because the file is gone: html_handling can no longer 307 the `.html` form for a
    // file it can no longer see, which is the same lesson the block above exists for.
    const retiredTarget = RETIRED_URLS.get(`/${canonicalName}`);
    if (retiredTarget) {
      const canonical = new URL(retiredTarget, url);
      canonical.search = url.search;
      return Response.redirect(canonical.toString(), 301);
    }

    // The URL guard. Once the files live under pages/, the asset server would happily serve
    // them at `/pages/business` too — a second URL for identical content, which splits
    // inbound links and is the kind of thing that is very hard to take back later. So the
    // file location is never a URL: any /pages/* request is redirected to the canonical
    // extensionless root URL. 301 (permanent) because this is a fact about the site's URL
    // shape, not a temporary state.
    if (segments[0] === "pages" && segments.length >= 2) {
      const canonical = new URL(
        "/" + segments.slice(1).join("/").replace(/\.html$/, ""),
        url,
      );
      canonical.search = url.search;
      return Response.redirect(canonical.toString(), 301);
    }

    // /<handle> → the seller identity + profile page, the canon address.
    //
    // It sits HERE, last of the claiming routes, and that position is the mechanism rather
    // than a style choice: every block above has already answered for the page names, the
    // canonical .html and trailing-slash forms, the retired URLs and the /pages/* guard, so
    // by the time a request reaches this line no reserved name is left in it. RESERVED is
    // checked anyway — the same guarantee stated twice, because the cost of getting this
    // wrong is a seller quietly shadowing a page nobody notices for a week.
    //
    // A handle with no profile falls through to the passthrough and gets an honest 404 from
    // the asset server, exactly like any other path with nothing behind it.
    if (
      segments.length === 1 &&
      HANDLE.test(segments[0]) &&
      !RESERVED.has(segments[0]) &&
      HANDLES.has(segments[0])
    ) {
      return servePage("seller", url, request, env);
    }

    // Genuine 404s must never be cached: a cached 404 is exactly what poisons a path
    // the moment it later becomes valid (a new route, a new file). Real assets cache.
    const response = await env.ASSETS.fetch(request);
    return response.status === 404 ? noStore(response) : response;
}
