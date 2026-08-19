// SquidBay CI gate 2 — one card per surface, and every local reference resolves.
//
// Ported from hq-factory design-system/ci/manifest-check.mjs. The @dsCard half is
// carried over verbatim so design-system cards inherit the gate the day they land here.
// The reference-resolving half is the same check the original already ran on card HTML,
// widened to this repo's shipped pages — because on marketplace that is where the
// surfaces live, and a port that only watched @dsCard files would report "cards: 0,
// clean" forever and fail nothing.
//
// Why it matters more after T2: until the deploy pipeline existed, a dead href sat in
// git until a human ran wrangler. With merge = ship, it reaches visitors on merge.
//
// Resolution mirrors Cloudflare Workers Static Assets: /foo serves foo.html, /foo/
// serves foo/index.html, / serves index.html. Same-origin absolute URLs are resolved
// too — that is how the legacy agent page referenced scripts, and it is exactly the
// class of break a root-relative-only check would wave through.
// Usage: node design-system/ci/manifest-check.mjs [rootDir]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const root = process.argv[2] || '.';
const SKIP = new Set(['node_modules', '.git', 'reference', 'uploads']);
const SAME_ORIGIN = /^https?:\/\/(www\.)?squidbay\.(ai|io)(?=\/|$)/i;

// ── FAIL CLOSED — absence of a subject is never absence of a problem ──────────────────
// Same shape as og-pixel-check's, and for the same reason. Until 2026-08-19 this gate had
// two ways to check nothing: pointed at a path that does not exist it died on an unhandled
// readdirSync throw (a stack trace, not a designed error), and pointed at a real directory
// holding no HTML it printed `0 page(s), 0 @dsCard, 0 local reference(s) checked` followed
// by `clean` and exited 0. The second is the dangerous one: green is exactly what a gate
// prints when it has verified something, and the publish boundary has already moved once
// under this repository (2026-08-16, "." → "public") — the move that silently disarmed
// gate 3 while it reported clean. A gate that cannot find its subject has NOT passed.
//
// There is deliberately NO waiver lane here, unlike gate 3's `images_absent`. This
// repository always serves pages; a legitimate zero-page state would be a new ruling, not
// something a gate should let through quietly.
const failClosed = (msg) => {
  console.error(`manifest-check: FAIL CLOSED — ${msg}`);
  console.error('::error::GATE 2 FAIL CLOSED — a gate that cannot find its subject has NOT passed.');
  process.exit(1);
};

if (!existsSync(root) || !statSync(root).isDirectory()) {
  failClosed(`${root} is not a directory, so this gate scanned NOTHING. Point the argument ` +
    `at the tree whose pages should be checked — the asset root wrangler publishes ` +
    `(\`public\`), which is what .github/workflows/guardrails.yml passes.`);
}

// Vanity paths the site Worker (workers/site/index.js) serves from real files that do
// NOT sit at the URL's path. Without this, a legitimate worker URL like
// /skill/kraken/text-translation reads as a dead link and fails the gate — which is
// exactly what froze the worker deploy after the per-skill links landed. KEEP IN SYNC
// with the Worker: it serves /kraken from seller.html, rewrites /skill/<seller>/<slug> →
// skill.html and /skill/<seller>/<slug>/security → security-report.html, 301s
// /agent/<handle> → /<handle>, and 301s bare /agent and /agent/ → /personal.
//
// The bare /agent line is here because a REDIRECT is a live answer too. `public/agent/` is
// deleted, so `/agent/` resolves to no file and the marketplace grid's seller-link handler
// — `location.href="/agent/"+a.dataset.agent`, which this gate's (?:src|href)="…" regex
// reads straight out of the JS — went red the moment the folder went. The honest fix is the
// Worker route, not a quieter regex: the gate asks "would the Worker serve this?", and once
// the Worker 301s the path the answer is genuinely yes. Delete that route and this line must
// go with it, or the gate starts waving a dead URL through.
//
// /agent/kraken stays spelled out rather than widened to /agent/<anything>, even though the
// Worker now 301s the whole shape. A 301 is a live answer only when it lands somewhere: the
// Worker forwards /agent/nobody to /nobody, which is an honest 404, and a pattern that waved
// every /agent/<x> href through would be blessing a dead link. kraken is the one handle with
// a page, so kraken is the one the gate vouches for — here and in the canon route above it.
const WORKER_ROUTES = [
  /^\/skill\/[^/]+\/[^/]+\/security\/?$/,
  /^\/skill\/[^/]+\/[^/]+\/?$/,
  /^\/kraken\/?$/,
  /^\/agent\/kraken\/?$/,
  /^\/agent\/?$/,
];

// The Worker's page-map, same KEEP IN SYNC contract as WORKER_ROUTES above. Eight pages
// live in pages/ but are served at the URL root: /business is pages/business.html. So a
// root-relative reference may resolve one directory in, and this is where the gate learns
// that — deliberately as an extra CANDIDATE PATH rather than a blanket allow, so the
// referenced file still has to exist. A pattern that waves the reference through would
// pass just as happily the day someone deletes the page.
const PAGES_DIR = 'pages';

const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP.has(name)) walk(p); continue; }
    if (!/\.html$/i.test(name)) continue;
    pages.push({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') });
  }
};
walk(root);

// Same shape, one layer in: a directory that exists but holds no HTML is still a scan of
// nothing, and reporting that as clean is the same lie by a narrower route.
if (pages.length === 0) {
  failClosed(`${root} exists but contains no .html files, so this gate scanned NOTHING — ` +
    `no page, no card, no reference. Either the pages moved out from under this path or ` +
    `they are gone; both are a human's call, not a green tick.`);
}

// Does this reference resolve to something the Worker would actually serve?
const resolves = (fromDir, ref) => {
  let u = ref.replace(SAME_ORIGIN, '');
  u = u.split('#')[0].split('?')[0];
  if (!u) return true;                                   // pure fragment or bare origin
  if (u.startsWith('/') && WORKER_ROUTES.some((re) => re.test(u))) return true; // served by the Worker
  const base = u.startsWith('/') ? root : join(root, fromDir);
  const rel = u.startsWith('/') ? u.slice(1) : u;
  const candidates = u.endsWith('/') || rel === ''
    ? [join(base, rel, 'index.html')]
    : [join(base, rel), join(base, rel + '.html'), join(base, rel, 'index.html')];
  // Root-relative references may be served out of pages/ (see PAGES_DIR above).
  if (u.startsWith('/') && rel !== '') {
    candidates.push(join(root, PAGES_DIR, rel), join(root, PAGES_DIR, rel + '.html'));
  }
  return candidates.some(existsSync);
};

let errors = 0, cards = 0, refs = 0;
for (const page of pages) {
  if (/^<!--\s*@dsCard/.test(page.text)) {
    cards++;
    if (/-(390|768|landscape|portrait)$/i.test(page.path.replace(/\.html$/i, ''))) {
      console.error(`SIBLING ${page.path} — breakpoint-sibling card; surfaces carry ONE card with an in-card selector (S1).`);
      errors++;
    }
  }
  for (const m of page.text.matchAll(/(?:src|href)="([^"]*)"/g)) {
    const ref = m[1];
    if (!ref || ref.startsWith('#')) continue;
    if (/^(data:|mailto:|tel:|javascript:|\/\/)/i.test(ref)) continue;
    if (ref.includes('${') || ref.includes('{{')) continue;        // template placeholder
    if (/^https?:/i.test(ref) && !SAME_ORIGIN.test(ref)) continue; // genuinely external
    refs++;
    if (!resolves(dirname(page.path), ref)) {
      console.error(`MISSING ${page.path} → ${ref}`);
      errors++;
    }
  }
}
console.log(`manifest-check: ${pages.length} page(s), ${cards} @dsCard, ${refs} local reference(s) checked`);
if (errors) { console.error(`\nFAIL — ${errors} manifest error(s).`); process.exit(1); }
console.log('manifest-check: clean');
