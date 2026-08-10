// SquidBay CI gate 1 — the kill list. A build containing any retired hex
// (including rgb()/rgba() forms), retired token name, or retired font family
// FAILS. Exemptions are by file path only (retired-values.json exempt_paths).
// Usage: node ci/kill-list.mjs [rootDir]
// (Node-only; guarded so the in-browser design-system bundler can parse it.)
function killListMain(fs, path) {
  const { readFileSync, readdirSync, statSync } = fs;
  const { join, relative } = path;
  const root = process.argv[2] || '.';
  const law = JSON.parse(readFileSync(join(root, 'retired-values.json'), 'utf8'));
  const needles = [
    ...law.retired_hex.map(h => ({ kind: 'hex', s: h.toLowerCase() })),
    ...(law.retired_rgb_forms || []).map(h => ({ kind: 'rgb', s: h.toLowerCase() })),
    ...law.retired_token_names.map(t => ({ kind: 'token', s: t.toLowerCase() })),
  ];
  // A retired face is a CHOSEN face - the first family in the stack. Later entries are
  // fallbacks: `-apple-system, ..., Helvetica, Arial, sans-serif` is a system stack, not a
  // typeface decision. Matching the tail makes the gate red on a clean tree, and a gate that
  // cries wolf gets switched off.
  const fontRe = law.retired_font_families.map(
    f => new RegExp(`font-family\\s*:\\s*['"]?${f}\\b`, 'i'));
  const TEXT = /\.(html|css|js|jsx|mjs|ts|tsx|json|md|svg)$/i;
  const SKIP_DIRS = new Set(['node_modules', '.git']);
  const exempt = (rel) => (law.exempt_paths || []).some(p => {
    const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\u0001/g, '.*') + '$');
    return re.test(rel) || re.test(rel.split('/').pop());
  });
  let hits = 0;
  const scan = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!SKIP_DIRS.has(name) && !name.startsWith('_')) scan(p); continue; }
      if (!TEXT.test(name)) continue;
      const rel = relative(root, p).replace(/\\/g, '/');
      if (exempt(rel)) continue;
      const text = readFileSync(p, 'utf8');
      const lower = text.toLowerCase();
      for (const n of needles) {
        let i = lower.indexOf(n.s);
        while (i !== -1) {
          if (n.kind !== 'token' || !/[\w-]/.test(lower[i + n.s.length] || '')) {
            const line = text.slice(0, i).split('\n').length;
            console.error(`KILL ${rel}:${line} ${n.kind} ${n.s}`);
            hits++;
          }
          i = lower.indexOf(n.s, i + 1);
        }
      }
      for (const re of fontRe) {
        const m = text.match(re);
        if (m) { console.error(`KILL ${rel} font ${m[0].slice(0, 60)}`); hits++; }
      }
    }
  };
  scan(root);
  if (hits) { console.error(`\nFAIL — ${hits} retired value(s) found.`); process.exit(1); }
  console.log('kill-list: clean');
}
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  const ns = 'node:';
  Promise.all([import(ns + 'fs'), import(ns + 'path')]).then(([fs, path]) => killListMain(fs, path));
}
