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
//   /skill/<seller>/<slug>/security  → the security-report page
//   /skill/<seller>/<slug>           → the skill page
//   /agent/<handle>                  → the agent seller/profile page
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // "/skill/codekraken/pull-request-review/" → ["skill","codekraken","pull-request-review"]
    const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

    if (segments[0] === "skill") {
      if (segments.length === 4 && segments[3] === "security") {
        return noStore(await env.ASSETS.fetch(assetRequest("/security-report", url, request)));
      }
      if (segments.length === 3) {
        return noStore(await env.ASSETS.fetch(assetRequest("/skill", url, request)));
      }
    }

    // /agent/<handle> → the agent seller/profile page. Only kraken has a demo profile
    // today, so only kraken resolves; every other seller is an honest 404 until it has
    // a real page. That is the intended demo shape: a seller name links somewhere only
    // when there is somewhere to land.
    if (segments[0] === "agent" && segments.length === 2 && segments[1] === "kraken") {
      return noStore(await env.ASSETS.fetch(assetRequest("/seller", url, request)));
    }

    // The page-map. `url.pathname` is matched WHOLE and extensionless — `/business` serves,
    // while `/business.html` and `/business/` redirect to it in the block below. Exactly one
    // of the three answers 200; the other two point at it. That is the whole URL contract.
    //
    // Ask for the moved location first, fall back to the root one. `env.ASSETS.fetch` is a
    // subrequest straight to the asset server, so neither of these re-enters this Worker and
    // no loop is possible. The 404 test is what makes the fallback work: with the navigation
    // headers stripped (see note 2) a real asset resolves 200 and a missing one is an honest
    // 404, so a 404 here means "not moved yet", not "broken".
    const pageName = url.pathname.slice(1);
    if (PAGES.has(pageName)) {
      const moved = await env.ASSETS.fetch(assetRequest(`/pages/${pageName}`, url, request));
      if (moved.status !== 404) return noStore(moved);
      return noStore(await env.ASSETS.fetch(assetRequest(`/${pageName}`, url, request)));
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
    const canonicalName = pageName.replace(/\/$/, "").replace(/\.html$/, "");
    if (canonicalName !== pageName && PAGES.has(canonicalName)) {
      const canonical = new URL(`/${canonicalName}`, url);
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

    // Genuine 404s must never be cached: a cached 404 is exactly what poisons a path
    // the moment it later becomes valid (a new route, a new file). Real assets cache.
    const response = await env.ASSETS.fetch(request);
    return response.status === 404 ? noStore(response) : response;
  },
};
