// The SITE Worker's script — the vanity skill/agent routes, and nothing else.
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
// wrangler.toml's `run_worker_first` lists `/skill/*` and `/agent/*`, so both reach this
// script before the asset server answers. /agent/* had to be added: as an asset-miss
// fallback it 404'd real browsers and never ran under local Miniflare at all.

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

    // Genuine 404s must never be cached: a cached 404 is exactly what poisons a path
    // the moment it later becomes valid (a new route, a new file). Real assets cache.
    const response = await env.ASSETS.fetch(request);
    return response.status === 404 ? noStore(response) : response;
  },
};
