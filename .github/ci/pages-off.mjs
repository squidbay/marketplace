// PUBLIC DOOR 2 — GitHub Pages.
//
// `.assetsignore` is a Cloudflare Workers Static Assets mechanism. GitHub Pages does not
// read it. Everything the denylist hides from https://squidbay.ai/ is hidden from ONE of
// this repository's two public doors, and if the Pages site ever resolves, every one of
// those files is public at a second address immediately, with no deploy of ours:
//
//   wrangler.toml · .github/ci/retired-values.json · package.json · README.md · the whole
//   workers/ source tree · design-system/ci/ · design-system/og-template.html
//
// WHY IT READS THE API AND NOT THE BROWSER
//   A 404 on https://squidbay.github.io/marketplace/ is NOT proof the switch is off. Read
//   on 2026-08-15, the same minute, both of these were true:
//
//     API   status "built", build_type "workflow", source { branch: "main", path: "/" },
//           public true
//     live  404 "Site not found - GitHub Pages"
//
//   Three layers can each say something different — the config record (API), the build
//   history (workflow runs), and the live surface (a browser). That day they read:
//   armed / idle / dark. Only the config record describes the switch, so only the config
//   record is what this gate reads.
//
// PASS  — the Pages API returns 404: no Pages site is configured. The door is unwired.
// FAIL  — the API returns a site whose `status` is anything but disabled, or whose
//         `source` names a branch. Either means the switch is still wired.
// FAIL CLOSED — the API cannot be read at all (no token, 401, 403, 5xx, unparseable).
//         A gate that cannot read its input has NOT passed.
//
// THIS GATE NEVER CHANGES THE SETTING — it asserts state and nothing else. Clearing the
// record IS automation, though: DELETE /repos/<owner>/<repo>/pages does it in one call.
// This gate deliberately does not make that call; a gate that repairs what it measures
// can never report the thing it was built to report.
//
// Usage: node .github/ci/pages-off.mjs [owner/repo]
//   token from GITHUB_TOKEN or GH_TOKEN; repo defaults to GITHUB_REPOSITORY.
// Node-only, zero dependencies.

const repo = process.argv[2] || process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const api = process.env.GITHUB_API_URL || 'https://api.github.com';

const HEAD = 'DOOR 2 — GitHub Pages';
const SCOPE = '  scope        : the repository Pages configuration record for ';
const BLIND = '  blind to     : the Cloudflare asset upload. That door is checked by .github/ci/publish-set.mjs, separately.';

const failClosed = (msg) => {
  console.log(HEAD);
  console.log(`${SCOPE}${repo || '<unknown repo>'}`);
  console.log(BLIND);
  console.log(`${HEAD}: FAIL CLOSED`);
  console.error(`::error::DOOR 2 FAIL CLOSED — ${msg} A gate that cannot read its input has NOT passed.`);
  process.exit(1);
};

if (!repo) failClosed('No repository given (argv[1] or GITHUB_REPOSITORY).');
if (!token) failClosed('No GITHUB_TOKEN / GH_TOKEN in the environment. Reading the Pages configuration needs the `pages: read` permission.');

const res = await fetch(`${api}/repos/${repo}/pages`, {
  headers: {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'squidbay-pages-off-gate',
  },
}).catch(e => failClosed(`Request to the Pages API failed: ${e.message}.`));

console.log(HEAD);
console.log(`${SCOPE}${repo}`);
console.log(BLIND);
console.log(`  read from    : GET ${api}/repos/${repo}/pages → HTTP ${res.status}`);

// 404 is how GitHub reports "this repository has no Pages site." That is the pass.
if (res.status === 404) {
  console.log('  status       : (no Pages site configured)');
  console.log('  source       : (none)');
  console.log(`${HEAD}: GREEN (this lane only) — the switch is off.`);
  process.exit(0);
}

if (res.status !== 200) {
  const body = await res.text().catch(() => '');
  failClosed(`The Pages API answered HTTP ${res.status}, which is neither a configured site (200) ` +
             `nor an absent one (404), so the state of the switch is unknown. ${body.slice(0, 300)}`);
}

let cfg;
try { cfg = await res.json(); }
catch (e) { failClosed(`The Pages API returned HTTP 200 with a body this gate could not parse: ${e.message}.`); }

const status = cfg.status === null ? 'null' : String(cfg.status);
const branch = cfg.source && cfg.source.branch ? cfg.source.branch : null;
const path = cfg.source && cfg.source.path ? cfg.source.path : null;

console.log(`  status       : ${status}`);
console.log(`  build_type   : ${cfg.build_type ?? '(none)'}`);
console.log(`  source       : ${branch ? `branch "${branch}" at "${path}"` : '(none)'}`);
console.log(`  public       : ${cfg.public}`);
console.log(`  html_url     : ${cfg.html_url ?? '(none)'}`);

const reasons = [];
if (status !== 'disabled') {
  reasons.push(`status is "${status}", not disabled — the Pages API is still describing a site for this repository`);
}
if (branch) {
  reasons.push(`source names branch "${branch}" at "${path}" — the switch is wired to a branch, so every file in it is one resolve away from being public at ${cfg.html_url ?? 'the Pages URL'}`);
}

if (reasons.length === 0) {
  console.log(`${HEAD}: GREEN (this lane only) — the switch is off.`);
  process.exit(0);
}

// Evidence on stdout, the annotation on stderr — the runner interleaves the two streams by
// flush order, and reasons printed above the config they are about read as noise.
for (const r of reasons) console.log(`PAGES ${r}`);
console.log(`${HEAD}: RED`);
console.error('::error::DOOR 2 RED — GitHub Pages is still configured on this repository. ' +
  reasons.join('; ') + '. ' +
  'THREE LAYERS, and they can each say something different: the RECORD (this repository\'s Pages ' +
  'configuration, GET /repos/' + repo + '/pages) · the BUILDS (Pages workflow runs, which go quiet ' +
  'on their own once nothing triggers them) · the SERVING surface (what the Pages URL returns to a ' +
  'browser). THIS GATE READS THE RECORD, and only the record, because the record is the layer that ' +
  'describes the switch: builds can be idle and the live URL can 404 while the record still names a ' +
  'branch — and every file in that branch is then one resolve away from being public, with no deploy ' +
  'of ours. FIX — delete the record. It is one API call, and it is automation, not hands: ' +
  '`gh api -X DELETE /repos/' + repo + '/pages` (needs a token carrying administration: write). ' +
  'SECOND OPTION, less reliable: Settings → Pages → Build and deployment → Source → None. That UI ' +
  'action has been observed to stop the builds and darken the site while LEAVING THE RECORD IN ' +
  'PLACE — the one layer this gate reads — so if you use it, re-run this gate to confirm it took ' +
  'rather than assuming it did.');
process.exit(1);
