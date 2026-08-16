// PUBLIC DOOR 1 — Cloudflare Workers Static Assets.
//
// A denylist checked by nothing is not a control. `.assetsignore` decides what
// `wrangler deploy` uploads out of `[assets] directory` — and three separate files reached
// https://squidbay.ai/ before anyone noticed them (wrangler.toml, retired-values.json,
// design-system/og-template.html), each found by hand, each after it was already public.
// This gate is what replaces "somebody noticed."
//
// ── WHAT CHANGED 2026-08-16, AND WHY THIS GATE HAD TO CHANGE WITH IT ──────────────────
// `[assets] directory` moved from "." to "public". BOTH of this gate's inputs move with it,
// and they move to DIFFERENT places, which is the part that is easy to get half-right:
//
//   * the ASSET ROOT is now <repo>/public       — the tree that publishes
//   * `.assetsignore` is now <repo>/public/.assetsignore  — wrangler reads it at the asset
//     root and NOWHERE else (measured; see below)
//   * the EXPECTED SET stays at <repo>/.github/ci/expected-public-set.txt — it is repository
//     machinery, deliberately outside the published tree so it can never publish itself
//
// A version of this gate that moved only the walk would keep reading a repository-root
// `.assetsignore` that wrangler no longer consults, and would report GREEN off a denylist
// with no effect on the real deploy. That is not a weaker gate; it is a gate that lies.
//
// MEASURED, wrangler 4.123.0, `WRANGLER_LOG=debug wrangler deploy --dry-run`, on a probe
// tree carrying a denylist in BOTH places with one victim file named by each:
//
//   ✨ Read 6 files from the assets directory <root>/public
//   Ignoring asset: .assetsignore
//   Ignoring asset: denied-by-assetroot.txt
//
// The file named by `public/.assetsignore` was ignored; the one named by the repository-root
// `.assetsignore` published. Patterns anchor to the ASSET ROOT, so a rule matches
// `design-system/ci`, not `public/design-system/ci`.
//
// ── WHY THE ASSET DIRECTORY IS PARSED OUT OF wrangler.toml AND NOT HARDCODED ───────────
// The boundary is the thing being protected, so the boundary cannot be a constant in the
// checker. If this file said `const ASSET_DIR = 'public'` and someone set `directory = "."`
// back in wrangler.toml, this gate would happily keep checking `public/`, find nothing
// unexpected, and print GREEN while the entire repository uploaded. A gate that cannot
// notice its own subject moved is the defect it was written to catch.
//
// WHAT IT DOES
//   1. Reads `[assets] directory` from wrangler.toml — the real boundary, not an assumption.
//   2. Walks that directory exactly as wrangler would — every file, no hardcoded skips.
//   3. Applies `<assetRoot>/.assetsignore`, plus the rule wrangler applies implicitly:
//      `.assetsignore` itself is never uploaded.
//   4. Compares the resulting publish set against the committed expected-set file.
//   5. FAILS on any path in the publish set that is not in the expected set.
//   6. FAILS CLOSED when any input is missing — wrangler.toml, the `[assets] directory` key,
//      the asset directory itself, `.assetsignore`, or the expected set. A gate that cannot
//      find its input has NOT passed — the lesson retired-values.json already paid for.
//
// PATH FORM — the expected set is REPOSITORY-root-relative (`public/site.css`), not
// asset-root-relative (`site.css`). Those were the same string while the asset root was the
// repository root and they are not any more. Repository-relative is the deliberate choice:
// it encodes the boundary INTO the gate's own input, so moving the boundary again turns
// every line red and forces a human to look. Asset-relative paths would have survived a
// silent boundary change unchanged, which is precisely the failure above. The published URL
// is the path with the asset root stripped — `public/site.css` serves /site.css — and the
// report prints that mapping so nobody has to hold it in their head.
//
// WHAT IT DOES NOT DO
//   This gate sees ONE of this repo's two public doors. GitHub Pages does not read
//   `.assetsignore` and is checked by `.github/ci/pages-off.mjs`, separately, so that a
//   green here can never be mistaken for "the repo is not leaking." Run both.
//
// SCOPE NOTE — why it walks the disk and not `git ls-files`:
//   wrangler uploads what is on disk in the deploy environment, tracked or not. Walking the
//   filesystem is the faithful model. On a CI checkout that equals the tracked tree; on a
//   developer's machine untracked scratch (a stray .wrangler/, a downloaded file) will show
//   up as unexpected — which is correct, because it is exactly what would ship if that
//   working copy were the one deploying.
//
// Usage: node .github/ci/publish-set.mjs [repoRoot]
// Node-only, zero dependencies (the design gates run without an npm install).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || '.';
const CONFIG_FILE = 'wrangler.toml';
const IGNORE_FILE = '.assetsignore';
const EXPECTED_FILE = '.github/ci/expected-public-set.txt';

const fail = (msg) => { console.error(`::error::${msg}`); process.exitCode = 1; };
const failClosed = (msg) => {
  console.log('DOOR 1 — Cloudflare Workers Static Assets: FAIL CLOSED');
  fail(msg);
  process.exit(1);
};

// ── The boundary, read from the config that actually defines it ───────────────────────
// A deliberately small TOML read rather than a dependency: find the `[assets]` table, then
// the first `directory = "..."` inside it. Stops at the next `[table]` header so a
// `directory` key belonging to some other table can never be mistaken for this one.
const configPath = join(root, CONFIG_FILE);
if (!existsSync(configPath)) {
  failClosed(`${CONFIG_FILE} is missing. This gate reads the publish boundary from its ` +
             `[assets] directory key; without it there is nothing to check and nothing is proven.`);
}

function readAssetDir(tomlText) {
  const lines = tomlText.split('\n');
  let inAssets = false;
  for (const line of lines) {
    const s = line.trim();
    if (s.startsWith('#')) continue;
    const table = s.match(/^\[([^\]]+)\]$/);
    if (table) { inAssets = table[1].trim() === 'assets'; continue; }
    if (!inAssets) continue;
    const kv = s.match(/^directory\s*=\s*["']([^"']*)["']/);
    if (kv) return kv[1];
  }
  return null;
}

const assetDir = readAssetDir(readFileSync(configPath, 'utf8'));
if (assetDir === null) {
  failClosed(`${CONFIG_FILE} has no [assets] directory key. This gate will not guess the ` +
             `publish boundary — a wrong guess reports GREEN while the repository uploads.`);
}

// `directory = "."` means the asset root IS the repository root; join() handles it.
const assetRoot = join(root, assetDir);
if (!existsSync(assetRoot) || !statSync(assetRoot).isDirectory()) {
  failClosed(`[assets] directory = "${assetDir}" but ${assetRoot} is not a directory. ` +
             `wrangler would have nothing to upload and this gate has nothing to check.`);
}

// ── The denylist, at the asset root, because that is where wrangler reads it ───────────
// Fail closed. If `.assetsignore` is gone, every file under the asset root would upload —
// that is the loudest possible failure and it must not be reported as "nothing unexpected."
const ignorePath = join(assetRoot, IGNORE_FILE);
if (!existsSync(ignorePath)) {
  failClosed(`${IGNORE_FILE} is missing from the asset root (${assetRoot}). Without it ` +
             `wrangler uploads everything under [assets] directory = "${assetDir}". ` +
             `A gate that cannot find its input has NOT passed. Note the location: wrangler ` +
             `reads this file at the ASSET ROOT, so one left at the repository root is inert.`);
}

const expectedPath = join(root, EXPECTED_FILE);
if (!existsSync(expectedPath)) {
  failClosed(`${EXPECTED_FILE} is missing. This gate compares the publish set against it; ` +
             `with no expected set there is nothing to compare against and nothing is proven. ` +
             `A gate that cannot find its input has NOT passed.`);
}

const rawPatterns = readFileSync(ignorePath, 'utf8')
  .split('\n')
  .map(l => l.replace(/\s+$/, ''))
  .filter(l => l !== '' && !l.startsWith('#'));

// gitignore-style matching, modelled on the `ignore` package wrangler uses.
//   - a leading `!` negates; last matching pattern wins
//   - a trailing `/` matches directories only
//   - a pattern containing `/` is anchored to the asset root; a bare name matches any
//     path segment at any depth
//   - a match on a directory excludes everything beneath it, which is why every rule ends
//     in `(?:/|$)` rather than `$`
//   - `**` crosses `/`, `*` and `?` do not
function compile(raw) {
  let p = raw, negate = false, dirOnly = false;
  if (p.startsWith('!')) { negate = true; p = p.slice(1); }
  if (p.endsWith('/')) { dirOnly = true; p = p.slice(0, -1); }
  let anchored = p.includes('/');
  if (p.startsWith('/')) { p = p.slice(1); anchored = true; }

  let body = '';
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') { body += '(?:.*/)?'; i += 2; }
      else { body += '.*'; i += 1; }
    } else if (p[i] === '*') {
      body += '[^/]*';
    } else if (p[i] === '?') {
      body += '[^/]';
    } else {
      body += p[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  const head = anchored ? '^' : '(?:^|/)';
  const tail = dirOnly ? '/' : '(?:/|$)';
  return { raw, negate, re: new RegExp(head + body + tail) };
}

const patterns = rawPatterns.map(compile);

// A path is ignored if the last pattern that matches it is not a negation. Because every
// rule ends in `(?:/|$)`, a directory pattern matches its descendants directly and no
// separate ancestor walk is needed. The path handed in here is ASSET-ROOT-relative, because
// that is the address wrangler matches patterns against.
function ignoredBy(relAsset) {
  let hit = null;
  for (const p of patterns) if (p.re.test(relAsset)) hit = p;
  return hit && !hit.negate ? hit.raw : null;
}

// ── Walk the asset root ───────────────────────────────────────────────────────────────
// No hardcoded skips, not even .git. If someone deletes `.git` from `.assetsignore`, this
// gate must go red — a gate with its own private exclusion list is modelling a deploy that
// does not exist.
const walked = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (st.isFile()) {
      walked.push({
        // what wrangler matches patterns against, and what determines the URL
        asset: relative(assetRoot, p).replace(/\\/g, '/'),
        // what the expected set is written in, so the boundary itself is gated
        repo: relative(root, p).replace(/\\/g, '/'),
      });
    }
  }
})(assetRoot);

const publish = [];
let ignoredCount = 0;
for (const f of walked) {
  // wrangler never uploads the denylist itself.
  if (f.asset === IGNORE_FILE) { ignoredCount++; continue; }
  if (ignoredBy(f.asset)) { ignoredCount++; continue; }
  publish.push(f);
}

// ── The expected set ──────────────────────────────────────────────────────────────────
const expected = new Set(
  readFileSync(expectedPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'))
);

const unexpected = publish.filter(p => !expected.has(p.repo));
const publishSet = new Set(publish.map(p => p.repo));
const stale = [...expected].filter(p => !publishSet.has(p)).sort();

// ── Report ────────────────────────────────────────────────────────────────────────────
const urlOf = (assetRel) => '/' + assetRel.replace(/(^|\/)index\.html$/, '$1');

console.log('DOOR 1 — Cloudflare Workers Static Assets');
console.log('  scope        : what `wrangler deploy` uploads from [assets] directory → https://squidbay.ai/');
console.log('  blind to     : GitHub Pages. That door is asserted by .github/ci/pages-off.mjs, separately.');
console.log(`  repo root    : ${root}`);
console.log(`  boundary     : ${CONFIG_FILE} → [assets] directory = "${assetDir}"`);
console.log(`  asset root   : ${assetRoot}   (a file here at <p> serves https://squidbay.ai/<p>)`);
console.log(`  denylist     : ${join(assetDir, IGNORE_FILE)} — ${patterns.length} patterns, anchored at the asset root`);
console.log(`  expected-set : ${EXPECTED_FILE} — ${expected.size} paths, repository-root-relative`);
console.log(`  walked       : ${walked.length} files`);
console.log(`  ignored      : ${ignoredCount} (denylist + .assetsignore itself)`);
console.log(`  would publish: ${publish.length} paths; ${expected.size} expected; ${unexpected.length} unexpected`);

for (const p of stale) {
  console.log(`  STALE expected-set line, nothing publishes at this path: ${p}`);
}
if (stale.length) {
  console.log('  (STALE is reported, not failed on — this gate fails on the publish direction only.)');
}

if (unexpected.length) {
  // Evidence on stdout, the annotation on stderr. The runner interleaves the two streams by
  // flush order, so writing the offending paths to stderr prints them ABOVE the header that
  // explains them — a gate is read at the moment something breaks, and out-of-order evidence
  // is the wrong thing to hand someone then.
  for (const p of [...unexpected].sort((a, b) => a.repo.localeCompare(b.repo))) {
    console.log(`UNEXPECTED ${p.repo}   → would answer https://squidbay.ai${urlOf(p.asset)}`);
  }
  fail(`DOOR 1 RED — ${unexpected.length} path(s) would be published at https://squidbay.ai/ ` +
       `that are not in ${EXPECTED_FILE}. Either add the path to ${join(assetDir, IGNORE_FILE)} ` +
       `(it should not be public) or add it to the expected set (it should). Do not do both.`);
  console.log('DOOR 1 — Cloudflare: RED');
} else {
  console.log('DOOR 1 — Cloudflare: GREEN (this lane only)');
}
