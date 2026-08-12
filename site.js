// squidbay.ai shared chrome: <sb-nav> + <sb-footer> (+ back-to-top, lifted from
// squidbay/squidbay components/footer.html + css/styles.css — bottom LEFT, the
// chatbot pill owns bottom-right; cyan → teal tokens).
(function () {
  // The trench backdrop (.ocean-bg — the faint teal/ink radials + grain from
  // design-system effects.css) is the platform's signature background. It was
  // living as a hardcoded class on index.html's <body> only, so 13 of 14 pages
  // painted flat --black with no teal filter — exactly the mismatch Andrew saw
  // on /business. Own it here, at the same layer as the shared chrome, so a
  // page cannot exist without it and the class cannot drift back out of sync.
  // Idempotent: index.html still carries the attribute; add() is a no-op there.
  document.body.classList.add('ocean-bg');

  // Some pages (the skill detail page) carry a fixed bottom purchase bar
  // (.buybar) with the price and Sign-in. The back-to-top and the chatbot both
  // fix themselves to the bottom corners at a much higher z-index, so on mobile
  // they land ON TOP of that bar and cover exactly the price and the button.
  // Tag the page so the CSS below can lift both floating controls ABOVE the bar
  // on mobile — nothing is hidden, it just stacks in the right order. (defer =
  // the DOM is parsed, so the bar is already present to detect.)
  if (document.querySelector('.buybar')) document.body.classList.add('has-buybar');

  const LINKS = [['Marketplace', '/marketplace'], ['Docs', '/docs'], ['Pricing', '/business']];

  // One source of truth for the full site link map. BOTH the footer columns and
  // the mobile drawer render from this, so a link cannot be present in one and
  // missing from the other — the drawer used to carry only the three top-nav
  // links, which is what left the mobile slider short. Order and grouping are
  // the footer's.
  const NAV_GROUPS = [
    ['Product', [['Factory', '/business'], ['Personal agent', '/personal'], ['Native app', '/app'], ['Marketplace', '/marketplace']]],
    ['Company', [['Docs', '/docs'], ['Support', '/support'], ['Register', '/register']]],
    ['Legal', [['Legal', '/legal'], ['Refunds', '/legal/refund']]],
  ];

  // The wordmark is ONE flex item, and that is the whole point.
  //
  // It used to be written as `Squid<span>Bay</span>` directly inside an
  // inline-flex parent. In a flex container a bare text run becomes its own
  // anonymous flex ITEM, so "Squid" and "Bay" were two items with the parent's
  // `gap` (10px nav / 9px footer) shoved between them. A `margin-left:-7px`
  // (and -6px in the footer) dragged them back until it LOOKED like one word.
  //
  // It only ever looked like one. Flex items are separate boxes, so the
  // accessibility tree, copy-paste, and every text extractor read the brand as
  // "Squid Bay" — two words. The negative margin fixed the pixels and left the
  // meaning broken, which is the worst kind of fix: invisible to the eye,
  // obvious to a screen reader.
  //
  // Wrapping both halves in one span makes the wordmark a single flex item with
  // "Squid" and "Bay" in normal inline flow. The gap now falls only between the
  // logo and the word, where it belongs, so the hack is not needed — it is
  // deleted, not neutralised. The two-tone colour is unchanged.
  // Line icons for the mobile drawer's top-nav rows, keyed by href. The drawer
  // mirrors the top navigation only (LINKS) — NOT the footer — so it needs its
  // own small marketplace-flavoured iconography: a storefront, a doc, a tag.
  const NAV_ICONS = {
    '/marketplace': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 20v-6h6v6"/></svg>',
    '/docs': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
    '/business': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-8-8V4a1 1 0 0 1 1-1h8.6l8.4 8.4a2 2 0 0 1 0 2z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
    '/register': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };
  // The drawer's own row set: the top nav (LINKS) plus Sign in. The two bottom
  // CTAs below mirror the landing hero exactly — "Deploy a Factory" / "Meet your
  // agent" — so the slider advertises the same two products the front door does.
  const DRAWER_ROWS = [...LINKS, ['Sign in', '/register']];

  const wordmark = (px) =>
    `<img src="/assets/squidbay-logo.png" alt="" style="width:${px}px;height:${px}px;object-fit:contain">` +
    `<span>Squid<span style="color:var(--primary)">Bay</span></span>`;
  class SbNav extends HTMLElement {
    connectedCallback() {
      // LINKS hold leading-slash paths ("/marketplace"), so the old
      // .split('/').pop() — which yields "marketplace" — could never equal one of
      // them and no nav item ever rendered as active. Compare the same shape on
      // both sides: strip a legacy .html suffix and any trailing slash, keeping "/".
      const here = location.pathname.replace(/\.html$/, '').replace(/(.)\/+$/, '$1') || '/';
      this.innerHTML = `
<div style="border-bottom:1px solid var(--border-subtle);position:relative;z-index:50">
<div class="container" style="display:flex;align-items:center;gap:28px;min-height:64px">
<a href="/" style="display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:19px;letter-spacing:-0.02em;color:var(--white)">
${wordmark(28)}</a>
<span style="flex:1"></span>
<span class="nav-links" style="display:inline-flex;align-items:center;gap:26px">
${LINKS.map(([l, h]) => `<a href="${h}" style="color:${h === here ? 'var(--white)' : 'var(--text-muted)'};font-size:15px;font-weight:500">${l}</a>`).join('')}
<a class="btn btn-secondary" href="/register" style="min-height:40px;padding:10px 20px;font-size:14px;border-color:var(--primary);color:var(--primary)">Sign in</a></span>
<button class="nav-burger" aria-label="Menu" style="display:none;width:44px;height:44px;background:transparent;border:1px solid var(--border-default);border-radius:var(--radius-md);color:var(--white);cursor:pointer;align-items:center;justify-content:center">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg></button>
</div>
<div class="nav-drawer" style="display:none;position:fixed;inset:0;z-index:60">
<div class="nav-scrim" style="position:absolute;inset:0;background:var(--surface-overlay);backdrop-filter:blur(4px)"></div>
<div class="nav-drawer-panel" style="position:absolute;right:0;top:0;bottom:0;width:300px;max-width:88%;background:var(--dark);box-shadow:var(--shadow-2);display:flex;flex-direction:column;overflow-y:auto">
<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border-subtle)">
<span style="display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;color:var(--white)">${wordmark(22)}</span>
<button class="nav-close" aria-label="Close" style="width:40px;height:40px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:24px;line-height:1">×</button>
</div>
<nav style="display:flex;flex-direction:column;padding:8px 0">
${DRAWER_ROWS.map(([l, h]) => `<a href="${h}" style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 18px;border-bottom:1px solid var(--border-subtle);color:${h === here ? 'var(--primary)' : 'var(--white)'};font-size:16px;font-weight:600">
<span style="display:inline-flex;flex-shrink:0;color:${h === here ? 'var(--primary)' : 'var(--text-muted)'}">${NAV_ICONS[h] || ''}</span>
<span style="flex:1">${l}</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></a>`).join('')}
</nav>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:10px;padding:18px;border-top:1px solid var(--border-subtle)">
<a class="btn btn-primary" href="/business">Deploy a Factory</a>
<a class="btn btn-secondary" href="/personal" style="border-color:var(--primary);color:var(--primary)">Meet your agent</a>
<span class="mono" style="font-size:9px;letter-spacing:1.5px;color:var(--patent-gold);text-align:center;margin-top:2px">Fire, returned.</span>
</div>
</div></div></div>
<style>@media (max-width:767px){sb-nav .nav-links{display:none!important}sb-nav .nav-burger{display:inline-flex!important}}
/* While the drawer is open, hide the floating chrome. The chatbot pill and the
   back-to-top fix to the bottom corners at z-index ~9999 — above the drawer —
   so the chatbot was sitting on top of the drawer's "Meet your agent" CTA. An
   open menu owns the screen; the FABs come back the moment it closes. */
body.drawer-open .chatbot-container,body.drawer-open .back-to-top{display:none!important}</style>`;
      const drawer = this.querySelector('.nav-drawer');
      const setDrawer = (open) => { drawer.style.display = open ? 'block' : 'none'; document.body.classList.toggle('drawer-open', open); };
      this.querySelector('.nav-burger').onclick = () => setDrawer(true);
      this.querySelector('.nav-close').onclick = () => setDrawer(false);
      this.querySelector('.nav-scrim').onclick = () => setDrawer(false);
    }
  }
  class SbFooter extends HTMLElement {
    connectedCallback() {
      const col = (t, rows) => `<div class="foot-col"><span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--text-muted)">${t}</span>${rows.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</div>`;
      this.innerHTML = `
<footer style="border-top:1px solid var(--border-subtle);margin-top:64px">
<div class="container" style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding-top:var(--space-10);padding-bottom:var(--space-8)">
<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3)">
<span style="display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px">${wordmark(24)}</span>
<span style="font-size:13px;color:var(--text-muted);line-height:1.6">Work gets done. You stay the gate.</span>
<span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--patent-gold)">Fire, returned.</span></div>
<div class="sb-foot-cols">${NAV_GROUPS.map(([t, rows]) => col(t, rows)).join('')}</div>
</div>
<div class="container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);padding-top:var(--space-4);padding-bottom:var(--space-5);border-top:1px solid var(--border-subtle)">
<span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--text-muted)">© 2026 SquidBay · squidbay.ai</span>
<span style="display:inline-flex;gap:14px;color:var(--text-muted)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span>
</div></footer>
<button class="back-to-top" id="sb-btt" aria-label="Back to top">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
</button>
<style>/* Footer columns: three equal groups. Desktop centres them; mobile lays them
   as a 3-column grid (repeat(3,1fr)) instead of the old vertical stack, which
   ran a full phone screen tall. A grid holds three equal columns and cannot
   wrap 2+1 the way the flexed min-width:120px layout did. */
.sb-foot-cols{display:grid;grid-template-columns:repeat(3,auto);justify-content:center;gap:var(--space-12)}
.foot-col{display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3)}
.foot-col a{color:var(--text-muted);font-size:13.5px}
.foot-col a:hover{color:var(--white)}
@media (max-width:767px){
  .sb-foot-cols{grid-template-columns:repeat(3,1fr);gap:var(--space-3);width:100%;max-width:340px}
  .foot-col{align-items:flex-start;text-align:left;gap:var(--space-2)}
  .foot-col a{font-size:13px}
}
.back-to-top{position:fixed;bottom:30px;left:30px;width:48px;height:48px;background:var(--dark);border:1px solid var(--gray);border-radius:50%;color:var(--primary);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transform:translateY(20px);transition:all var(--t-state);z-index:9998;box-shadow:0 4px 20px rgba(0,0,0,0.3)}
.back-to-top:hover{background:var(--gray);border-color:var(--primary);transform:translateY(-2px);box-shadow:0 8px 30px rgba(70,196,196,0.2)}
.back-to-top.visible{opacity:1;visibility:visible;transform:translateY(0)}
@media (max-width:768px){.back-to-top{bottom:20px;left:20px;width:44px;height:44px}}
/* When a fixed purchase bar (.buybar, ~68px + safe-area) owns the bottom edge,
   lift the two floating controls above it so they never cover the price or the
   Sign-in button. Higher specificity than the chatbot's own portrait rule, so
   no !important needed. */
@media (max-width:768px){
  body.has-buybar .back-to-top{bottom:calc(84px + env(safe-area-inset-bottom))}
  body.has-buybar .chatbot-container{bottom:calc(84px + env(safe-area-inset-bottom))}
}</style>`;
      const btt = this.querySelector('#sb-btt');
      btt.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      const onScroll = () => btt.classList.toggle('visible', window.scrollY > 300);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  // ── SquidBot ───────────────────────────────────────────────────────────────
  // The chatbot is a real component with a real backend (POST /chat), not the
  // design kit's chat-simulator. It lives in /components/ and is unchanged
  // except for the token re-skin; this is only the loader.
  //
  // chatbot.js waits for the 'squidbay:components-loaded' event before it
  // queries its own elements, so the order is fixed: styles, then markup into
  // the DOM, then the script, then the event. Firing the event before the
  // markup exists gives you a silent no-op — every getElementById returns null
  // and nothing throws.
  async function mountSquidBot() {
    if (document.querySelector('.chatbot-container')) return;
    try {
      if (!document.querySelector('link[href="/components/chatbot.css"]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = '/components/chatbot.css';
        document.head.appendChild(css);
      }
      const res = await fetch('/components/chatbot.html');
      if (!res.ok) throw new Error('chatbot.html ' + res.status);
      const holder = document.createElement('div');
      holder.innerHTML = await res.text();
      while (holder.firstChild) document.body.appendChild(holder.firstChild);

      await new Promise((resolve, reject) => {
        if (document.querySelector('script[src="/components/chatbot.js"]')) return resolve();
        const js = document.createElement('script');
        js.src = '/components/chatbot.js';
        js.onload = resolve;
        js.onerror = () => reject(new Error('chatbot.js failed to load'));
        document.body.appendChild(js);
      });

      document.dispatchEvent(new CustomEvent('squidbay:components-loaded'));

      // The widget ships hidden (opacity:0; visibility:hidden) and is revealed
      // by .chatbot-container.ready — an anti-flash guard so it cannot appear
      // before its handlers are wired. chatbot.js exports showChatbotButton()
      // on window but never calls it; the old loader did, as its last step.
      // Miss this and everything looks correct — markup mounted, CSS loaded,
      // handlers bound, no console error — and a human sees nothing at all.
      if (typeof window.showChatbotButton === 'function') {
        window.showChatbotButton();
      } else {
        console.warn('SquidBot: showChatbotButton not found — widget will stay hidden');
      }
    } catch (e) {
      // A missing chatbot must never take the page down with it.
      console.warn('SquidBot not mounted:', e.message);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSquidBot);
  } else {
    mountSquidBot();
  }


  // ── Bubbles — Designer spec, 2026-08-11 ──────────────────────────────────
  // Hosts are OPT-IN, never universal. Two kinds only:
  //   deep — the hero band, ONE per page, 4 bubbles, never reaches the top edge
  //   edge — ONE featured card per band, 3 bubbles, crosses the edge mid-fade
  //
  // The catch is an illusion produced by --sb-travel, not by a keyframe: the
  // bubble crosses the card's top edge at ~91% of its cycle, inside sbRise's
  // 88->100% fade, so a half-faded ring slides through the corner radius.
  // A hard clip at full opacity is what we shipped before, and it came from
  // travel being too long for the container — hence --sb-h.
  //
  // Count rule is per VIEWPORT, not per container: never two hosts in one
  // screenful. Enforced below by requiring a viewport-height gap between hosts.
  const DEEP = ['sb-1','sb-2','sb-3','sb-4'];
  const EDGE = ['sb-1','sb-2','sb-3'];

  const NEVER = 'sb-nav,sb-footer,.chatbot-container,.chatbot-window,form,table';

  function addBubbles(host, kind, classes) {
    host.setAttribute('data-bubble-host', kind);
    classes.forEach(c => {
      const el = document.createElement('span');
      el.setAttribute('data-bubble', '');
      el.setAttribute('aria-hidden', 'true');
      el.className = c;
      host.appendChild(el);
    });
  }

  // Edge hosts need their rendered height so the crossing lands at ~91%.
  function sizeEdgeHosts() {
    document.querySelectorAll('[data-bubble-host]').forEach(el => {
      el.style.setProperty('--sb-h', Math.round(el.offsetHeight) + 'px');
    });
  }

  function mountBubbles() {
    if (document.querySelector('[data-bubble-host]')) return;
    const vh = window.innerHeight || 800;

    // deep: the hero band, one per page.
    const hero = document.querySelector('header.band');
    if (hero && !hero.closest(NEVER)) addBubbles(hero, 'deep', DEEP);

    // edge: one featured card per band, and only where it cannot share a
    // screenful with the hero or with a previous edge host.
    // With no hero there is no predecessor to share a screenful with, so the
    // first edge host on such a page must not be gated by the gap rule.
    let lastHostBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : -Infinity;
    // Any major section, not just .band — the landing page's featured cards
    // sit in <section class="container doors">, which is a full-screen band
    // visually but carries no .band class.
    // Plain `section`: the landing page's featured cards sit in
    // <section class="container doors"> inside a wrapper div, so any
    // parent-anchored selector misses them. Height + gap filters below do
    // the real qualifying work.
    document.querySelectorAll('section').forEach(band => {
      if (band.closest(NEVER)) return;
      const card = [...band.querySelectorAll('.card')].find(c => {
        if (c.closest(NEVER) || c.querySelector('input,textarea,select')) return false;
        const h = c.offsetHeight;
        return h >= 280 && h <= 520;   // the spec's featured-card window
      });
      if (!card) return;
      const top = card.getBoundingClientRect().top + window.scrollY;
      if (top - lastHostBottom < vh * 0.5) return;  // would share a screenful
      addBubbles(card, 'edge', EDGE);
      lastHostBottom = card.getBoundingClientRect().bottom + window.scrollY;
    });

    sizeEdgeHosts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBubbles);
  } else { mountBubbles(); }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(sizeEdgeHosts, 150);   // --sb-h must track the card
  }, { passive: true });

  if (!customElements.get('sb-nav')) customElements.define('sb-nav', SbNav);
  if (!customElements.get('sb-footer')) customElements.define('sb-footer', SbFooter);
})();
