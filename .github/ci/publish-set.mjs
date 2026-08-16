// PUBLIC DOOR 1 — Cloudflare Workers Static Assets.
//
// A denylist checked by nothing is not a control. `.assetsignore` decides what
// `wrangler deploy` uploads out of `[assets] directory = "."` — which on this repo is the
// whole repository root. Three separate files reached https://squidbay.ai/ before anyone
// noticed them (wrangler.toml, retired-values.json, design-system/og-template.html), each
// found by hand, each after it was already public. This gate is what replaces "somebody
// noticed."
//
// WHAT IT DOES
//   1. Walks the asset root exactly as wrangler would — every file, no hardcoded skips.
//   2. Applies `.assetsignore`'s gitignore-style patterns, plus the one rule wrangler
//      applies implicitly: `.assetsignore` itself is never uploaded.
//   3. Compares the resulting publish set against the committed expected-set file.
//   4. FAILS on any path in the publish set that is not in the expected set.
//   5. FAILS CLOSED when the expected-set file (or `.assetsignore`) is missing. A gate that
//      cannot find its input has NOT passed — the lesson retired-values.json already paid for.
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
// Usage: node .github/ci/publish-set.mjs [rootDir]
// Node-only, zero dependencies (the design gates run without an npm install).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || '.';
const IGNORE_FILE = '.assetsignore';
const EXPECTED_FILE = '.github/ci/expected-public-set.txt';

const fail = (msg) => { console.error(`::error::${msg}`); process.exitCode = 1; };

// ── The denylist ──────────────────────────────────────────────────────────────────────
// Fail closed. If `.assetsignore` is gone, EVERY file in this repo would upload — that is
// the loudest possible failure and it must not be reported as "nothing unexpected."
const ignorePath = join(root, IGNORE_FILE);
if (!existsSync(ignorePath)) {
  console.log('DOOR 1 — Cloudflare Workers Static Assets: FAIL CLOSED');
  fail(`${IGNORE_FILE} is missing. Without it wrangler uploads the entire repository root. ` +
       `A gate that cannot find its input has NOT passed.`);
  process.exit(1);
}

const expectedPath = join(root, EXPECTED_FILE);
if (!existsSync(expectedPath)) {
  console.log('DOOR 1 — Cloudflare Workers Static Assets: FAIL CLOSED');
  fail(`${EXPECTED_FILE} is missing. This gate compares the publish set against it; ` +
       `with no expected set there is nothing to compare against and nothing is proven. ` +
       `A gate that cannot find its input has NOT passed.`);
  process.exit(1);
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
// separate ancestor walk is needed.
function ignoredBy(rel) {
  let hit = null;
  for (const p of patterns) if (p.re.test(rel)) hit = p;
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
    else if (st.isFile()) walked.push(relative(root, p).replace(/\\/g, '/'));
  }
})(root);

const publish = [];
let ignoredCount = 0;
for (const rel of walked) {
  // wrangler never uploads the denylist itself.
  if (rel === IGNORE_FILE) { ignoredCount++; continue; }
  if (ignoredBy(rel)) { ignoredCount++; continue; }
  publish.push(rel);
}

// ── The expected set ──────────────────────────────────────────────────────────────────
const expected = new Set(
  readFileSync(expectedPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'))
);

const unexpected = publish.filter(p => !expected.has(p));
const publishSet = new Set(publish);
const stale = [...expected].filter(p => !publishSet.has(p)).sort();

// ── Report ────────────────────────────────────────────────────────────────────────────
console.log('DOOR 1 — Cloudflare Workers Static Assets');
console.log('  scope        : what `wrangler deploy` uploads from [assets] directory = "." → https://squidbay.ai/');
console.log('  blind to     : GitHub Pages. That door is asserted by .github/ci/pages-off.mjs, separately.');
console.log(`  asset root   : ${root}`);
console.log(`  denylist     : ${IGNORE_FILE} — ${patterns.length} patterns`);
console.log(`  expected-set : ${EXPECTED_FILE} — ${expected.size} paths`);
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
  for (const p of unexpected.sort()) console.log(`UNEXPECTED ${p}`);
  fail(`DOOR 1 RED — ${unexpected.length} path(s) would be published at https://squidbay.ai/ ` +
       `that are not in ${EXPECTED_FILE}. Either add the path to ${IGNORE_FILE} (it should not be ` +
       `public) or add it to the expected set (it should). Do not do both.`);
  console.log('DOOR 1 — Cloudflare: RED');
} else {
  console.log('DOOR 1 — Cloudflare: GREEN (this lane only)');
}
