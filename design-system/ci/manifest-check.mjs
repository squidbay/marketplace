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

// Vanity paths the site Worker (workers/site/index.js) serves from real files that do
// NOT sit at the URL's path. Without this, a legitimate worker URL like
// /skill/kraken/text-translation reads as a dead link and fails the gate — which is
// exactly what froze the worker deploy after the per-skill links landed. KEEP IN SYNC
// with the Worker: it rewrites /skill/<seller>/<slug> → skill.html,
// /skill/<seller>/<slug>/security → security-report.html, and /agent/kraken → seller.html.
const WORKER_ROUTES = [
  /^\/skill\/[^/]+\/[^/]+\/security\/?$/,
  /^\/skill\/[^/]+\/[^/]+\/?$/,
  /^\/agent\/kraken\/?$/,
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
