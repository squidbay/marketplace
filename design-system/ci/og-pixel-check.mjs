// SquidBay CI gate 3 — the OG pixel check. kill-list.mjs reads TEXT; an OG card is a
// PNG, so a retired palette rides in as pixels and every text gate waves it through
// (defect D3, 2026-08-11). This decodes each images/og/*.png with no dependencies and
// FAILS when a retired hex from retired-values.json covers a real share of the image.
// A flat background or panel clears the threshold; an anti-aliased edge does not.
// Usage: node design-system/ci/og-pixel-check.mjs [assetRoot]
//   assetRoot is the directory images/og lives under — the same asset root wrangler
//   publishes (public/). The gate's own inputs are NOT looked for inside it; see below.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

// Two roots, deliberately separate. The asset root is where the IMAGES are and moves
// with the publish boundary; this gate's own inputs are resolved from THIS FILE's
// location and do not move with it. Welding them together is what silently disarmed
// this gate: the tree moved under public/, the argument stayed ".", and the subject
// directory simply stopped existing while the gate reported green.
const here = dirname(fileURLToPath(import.meta.url));      // design-system/ci
const repoRoot = join(here, '..', '..');
const root = process.argv[2] || '.';
const dir = join(root, 'images/og');
const SHARE = 0.02; // 2% of opaque pixels — a fill, not an edge

const failClosed = (msg) => {
  console.error(`og-pixel-check: FAIL CLOSED — ${msg}`);
  console.error('::error::GATE 3 FAIL CLOSED — a gate that cannot find its subject has NOT passed.');
  process.exit(1);
};

// The law lives with the other gate inputs in .github/ci/, outside the asset root, so it
// can never publish. Missing law = no assertion set = nothing proven.
const lawPath = join(repoRoot, '.github', 'ci', 'retired-values.json');
if (!existsSync(lawPath)) {
  failClosed(`${lawPath} is missing. Every hex this gate tests for lives in that file; ` +
    'without it there is nothing to check.');
}
const law = JSON.parse(readFileSync(lawPath, 'utf8'));
const retired = new Set(law.retired_hex.map(h => h.replace('#', '').toUpperCase()));

// Waivers are keyed by sha256, never by path: regenerate the art and the waiver
// evaporates on its own. See og-waiver.json for who owns the outstanding ones. The same
// file is the ONLY place an absent images/og may be declared — see the check below.
const waiverPath = join(here, 'og-waiver.json');
const waiverDoc = existsSync(waiverPath) ? JSON.parse(readFileSync(waiverPath, 'utf8')) : {};
const waived = new Map();
for (const w of waiverDoc.waivers || []) {
  for (const [name, sha] of Object.entries(w.sha256 || {})) waived.set(`${name}|${sha}`, { owner: w.owner, when: w.when });
}
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// Minimal PNG decode: 8-bit RGB/RGBA, non-interlaced. Anything else THROWS rather than
// returning "clean" — a gate that silently skips what it cannot read is worse than none.
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, ihdr = null; const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += len + 12;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8 || ihdr.interlace !== 0 || (ihdr.color !== 2 && ihdr.color !== 6)) {
    throw new Error(`unsupported PNG (depth ${ihdr.depth}, colour ${ihdr.color}, interlace ${ihdr.interlace})`);
  }
  const bpp = ihdr.color === 6 ? 4 : 3, stride = ihdr.w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(ihdr.h * stride);
  let q = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[q++], line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      const v = line[i];
      cur[i] = (f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : f === 4 ? v + paeth(a, b, c) : v) & 0xff;
    }
  }
  return { ...ihdr, bpp, px: out };
}

// An absent subject is a FAILURE, never a pass. This gate used to exit 0 here, which meant
// any change that moved or renamed images/og disarmed it while `design gates` stayed green
// and nobody saw a colour change. There IS a way to say "no OG images on purpose" — it is a
// declaration in og-waiver.json, written by a person, with an owner and a reason. Absence
// on its own says nothing, so absence on its own is never allowed to say "clean".
const declared = waiverDoc.images_absent;
const declaredOk = declared && declared.owner && declared.why;
const sayDeclared = (what) => {
  console.log(`og-pixel-check: ${what}, and that is DECLARED in ${relative(repoRoot, waiverPath)} ` +
    `— owed by ${declared.owner} (${declared.when || 'no date given'}): ${declared.why}`);
};

if (!existsSync(dir)) {
  if (!declaredOk) {
    failClosed(`${dir} does not exist, so this gate scanned NOTHING. Either the OG images ` +
      `moved (point the argument at the directory images/og now lives under — the asset ` +
      `root wrangler publishes) or they are gone. If they are absent on purpose, declare it ` +
      `in ${relative(repoRoot, waiverPath)} as "images_absent": { "owner": ..., "when": ..., "why": ... }.`);
  }
  sayDeclared(`${dir} does not exist`);
  process.exit(0);
}

const files = readdirSync(dir).filter(f => /\.png$/i.test(f)).sort();
// Same shape, one layer in: a directory that exists but holds no PNG is still a scan of
// nothing, and reporting that as clean is the same lie by a narrower route.
if (files.length === 0) {
  if (!declaredOk) {
    failClosed(`${dir} exists but contains no .png files, so this gate scanned NOTHING. ` +
      `If that is deliberate, declare it in ${relative(repoRoot, waiverPath)} as ` +
      `"images_absent": { "owner": ..., "when": ..., "why": ... }.`);
  }
  sayDeclared(`${dir} holds no .png files`);
  process.exit(0);
}
let hits = 0, waivedHits = 0;
for (const name of files) {
  const rel = relative(root, join(dir, name)).replace(/\\/g, '/');
  const bytes = readFileSync(join(dir, name));
  const sha = createHash('sha256').update(bytes).digest('hex');
  const waiver = waived.get(`${name}|${sha}`);
  const img = decode(bytes);
  const counts = new Map();
  let opaque = 0;
  for (let i = 0; i < img.px.length; i += img.bpp) {
    if (img.bpp === 4 && img.px[i + 3] === 0) continue;
    opaque++;
    const hex = ((img.px[i] << 16) | (img.px[i + 1] << 8) | img.px[i + 2]).toString(16).padStart(6, '0').toUpperCase();
    if (retired.has(hex)) counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  for (const [hex, n] of [...counts].sort((x, y) => y[1] - x[1])) {
    const share = n / opaque;
    if (share < SHARE) continue;
    const where = `${rel} pixel #${hex} ${(share * 100).toFixed(1)}% of image`;
    if (waiver) { console.log(`WAIVED ${where} — owed by ${waiver.owner} (${waiver.when})`); waivedHits++; }
    else { console.error(`KILL ${where}`); hits++; }
  }
}
console.log(`og-pixel-check: ${files.length} image(s) scanned, ${waivedHits} waived finding(s) still owed`);
if (hits) { console.error(`\nFAIL — ${hits} retired palette fill(s) found in OG images.`); process.exit(1); }
console.log('og-pixel-check: clean');
