// SquidBay CI gate 3 — the OG pixel check. kill-list.mjs reads TEXT; an OG card is a
// PNG, so a retired palette rides in as pixels and every text gate waves it through
// (defect D3, 2026-08-11). This decodes each images/og/*.png with no dependencies and
// FAILS when a retired hex from retired-values.json covers a real share of the image.
// A flat background or panel clears the threshold; an anti-aliased edge does not.
// Usage: node design-system/ci/og-pixel-check.mjs [rootDir]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const root = process.argv[2] || '.';
const dir = join(root, 'images/og');
const SHARE = 0.02; // 2% of opaque pixels — a fill, not an edge

const law = JSON.parse(readFileSync(join(root, 'retired-values.json'), 'utf8'));
const retired = new Set(law.retired_hex.map(h => h.replace('#', '').toUpperCase()));

// Waivers are keyed by sha256, never by path: regenerate the art and the waiver
// evaporates on its own. See og-waiver.json for who owns the outstanding ones.
const waiverPath = join(root, 'design-system/ci/og-waiver.json');
const waived = new Map();
if (existsSync(waiverPath)) {
  for (const w of JSON.parse(readFileSync(waiverPath, 'utf8')).waivers || []) {
    for (const [name, sha] of Object.entries(w.sha256 || {})) waived.set(`${name}|${sha}`, { owner: w.owner, when: w.when });
  }
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

if (!existsSync(dir)) { console.log('og-pixel-check: no images/og — nothing to check'); process.exit(0); }
const files = readdirSync(dir).filter(f => /\.png$/i.test(f)).sort();
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
