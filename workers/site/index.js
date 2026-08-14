// The SITE Worker's script — the vanity skill route, and nothing else.
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
//   anything else                    → handed straight back to the asset server
//
// Two details that are load-bearing, so nobody has to rediscover them:
//
// 1. It asks the asset binding for the EXTENSIONLESS path (`/skill`), never
//    `/skill.html`. wrangler.toml sets html_handling = "auto-trailing-slash", under
//    which `/foo.html` is answered with a 307 to `/foo`. Fetching `/skill.html` here
//    would hand the visitor a redirect instead of a page; fetching `/skill` serves
//    skill.html with a 200, which is the whole point.
//
// 2. The final `env.ASSETS.fetch(request)` is a real passthrough, not a fallback of
//    last resort. It preserves not_found_handling = "404-page": a path that matches
//    no asset still gets 404.html WITH a 404 status. A genuine 404 must stay a 404.
//
// Only paths listed in wrangler.toml's `run_worker_first` reach this script at all
// (`/skill/*` today). Everything else on squidbay.ai is served by the asset server
// without invoking this code, exactly as it was before.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // "/skill/codekraken/pull-request-review/" → ["skill","codekraken","pull-request-review"]
    const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

    if (segments[0] === "skill") {
      if (segments.length === 4 && segments[3] === "security") {
        return env.ASSETS.fetch(new Request(new URL("/security-report", url), request));
      }
      if (segments.length === 3) {
        return env.ASSETS.fetch(new Request(new URL("/skill", url), request));
      }
    }

    // /agent/<handle> → the agent seller/profile page (seller.html serves the demo agent, kraken).
    if (segments[0] === "agent" && segments.length === 2) {
      return env.ASSETS.fetch(new Request(new URL("/seller", url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
