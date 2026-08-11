// squidbay.ai shared chrome: <sb-nav> + <sb-footer> (+ back-to-top, lifted from
// squidbay/squidbay components/footer.html + css/styles.css — bottom LEFT, the
// chatbot pill owns bottom-right; cyan → teal tokens).
(function () {
  const LINKS = [['Marketplace', '/marketplace'], ['Docs', '/docs'], ['Pricing', '/business']];

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
<div style="position:absolute;right:0;top:0;bottom:0;width:280px;max-width:85%;background:var(--dark);box-shadow:var(--shadow-2);padding:18px;display:flex;flex-direction:column;gap:6px">
<button class="nav-close" aria-label="Close" style="align-self:flex-end;width:44px;height:44px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:22px">×</button>
${LINKS.map(([l, h]) => `<a href="${h}" style="display:flex;align-items:center;min-height:48px;padding:0 12px;border-radius:var(--radius-md);color:var(--white);font-size:16px;font-weight:600">${l}</a>`).join('')}
<a class="btn btn-primary" href="/personal" style="margin-top:12px">Deploy your agent</a>
</div></div></div>
<style>@media (max-width:767px){sb-nav .nav-links{display:none!important}sb-nav .nav-burger{display:inline-flex!important}}
/* 3 x min-width:120px + two 48px gaps = 456px, against 339px usable at 375px.
   Side by side they wrap 2+1, which reads as a broken grid, not a centred one. */
@media (max-width:767px){sb-footer .sb-foot-cols{flex-direction:column;gap:var(--space-8)}}</style>`;
      const drawer = this.querySelector('.nav-drawer');
      this.querySelector('.nav-burger').onclick = () => drawer.style.display = 'block';
      this.querySelector('.nav-close').onclick = () => drawer.style.display = 'none';
      this.querySelector('.nav-scrim').onclick = () => drawer.style.display = 'none';
    }
  }
  class SbFooter extends HTMLElement {
    connectedCallback() {
      const col = (t, rows) => `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3);min-width:120px"><span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--text-muted)">${t}</span>${rows.map(([l, h]) => `<a href="${h}" style="color:var(--text-muted);font-size:13.5px">${l}</a>`).join('')}</div>`;
      this.innerHTML = `
<footer style="border-top:1px solid var(--border-subtle);margin-top:64px">
<div class="container" style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding-top:var(--space-10);padding-bottom:var(--space-8)">
<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3)">
<span style="display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px">${wordmark(24)}</span>
<span style="font-size:13px;color:var(--text-muted);line-height:1.6">Work gets done. You stay the gate.</span>
<span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--patent-gold)">Fire, returned.</span></div>
<div class="sb-foot-cols" style="display:flex;justify-content:center;gap:var(--space-12)">${col('Product', [['Factory', '/business'], ['Personal agent', '/personal'], ['Native app', '/app'], ['Marketplace', '/marketplace']])}
${col('Company', [['Docs', '/docs'], ['Support', '/support'], ['Register', '/register']])}
${col('Legal', [['Legal', '/legal'], ['Refunds', '/legal/refund']])}</div>
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
<style>.back-to-top{position:fixed;bottom:30px;left:30px;width:48px;height:48px;background:var(--dark);border:1px solid var(--gray);border-radius:50%;color:var(--primary);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transform:translateY(20px);transition:all var(--t-state);z-index:9998;box-shadow:0 4px 20px rgba(0,0,0,0.3)}
.back-to-top:hover{background:var(--gray);border-color:var(--primary);transform:translateY(-2px);box-shadow:0 8px 30px rgba(70,196,196,0.2)}
.back-to-top.visible{opacity:1;visibility:visible;transform:translateY(0)}
@media (max-width:768px){.back-to-top{bottom:20px;left:20px;width:44px;height:44px}}</style>`;
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


  // ── Ambient bubble column ────────────────────────────────────────────────
  // One shared layer instead of markup in 14 pages, so the column can never
  // drift page to page — which is exactly what happened before: bubbles
  // existed on index.html and nowhere else.
  //
  // System rules (tokens/effects.css): "marketing + loading surfaces ONLY…
  // Max 4 bubbles per view, one column." Four here, one column, right side.
  //
  // TWO of the four cling, on deliberately un-matched cycles (17s and 21s,
  // offset 1s and 9s). One clinging bubble on a 13s loop meant the catch was
  // visible for ~3s out of every 13 and you could easily watch for a minute
  // and never see it. Two on coprime-ish cycles means a catch is almost always
  // in progress somewhere, without the column ever pulsing in sync.
  //
  // Still not all four: the catch only reads as physics because other bubbles
  // rise straight past it. Make them all cling and it stops looking like water
  // and starts looking like a broken animation.
  //
  // Durations are long (12-21s) on purpose. These sit behind real content and
  // must never pull the eye — effects.css opens with "Motion is communication,
  // never decoration."
  //
  // Fixed + pointer-events:none + z-index 0 keeps it behind everything and
  // un-clickable. [data-bubble] is what the mandatory prefers-reduced-motion
  // rule targets, so these go static at 0.35 opacity for free.
  function mountBubbles() {
    if (document.querySelector('.sb-bubbles')) return;
    const wrap = document.createElement('div');
    wrap.className = 'sb-bubbles';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
<style>
.sb-bubbles{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.sb-bubbles b{position:absolute;display:block;border-radius:50%;
  border:1px solid rgba(70,196,196,0.22);
  background:radial-gradient(circle at 32% 28%, rgba(231,243,242,0.12), transparent);
  animation-timing-function:linear;animation-iteration-count:infinite}
@media (max-width:767px){.sb-bubbles b:nth-child(n+3){display:none}}
</style>
<b data-bubble style="right:9%;bottom:-30px;width:22px;height:22px;animation-name:sbRise;animation-duration:15s"></b>
<b data-bubble style="right:13%;bottom:-30px;width:11px;height:11px;animation-name:sbRiseCling;animation-duration:17s;animation-delay:1s;border-color:rgba(70,196,196,0.3)"></b>
<b data-bubble style="right:7%;bottom:-30px;width:15px;height:15px;animation-name:sbRise;animation-duration:12s;animation-delay:5s"></b>
<b data-bubble style="right:16%;bottom:-30px;width:8px;height:8px;animation-name:sbRiseCling;animation-duration:21s;animation-delay:9s;border-color:rgba(70,196,196,0.16)"></b>`;
    document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBubbles);
  } else { mountBubbles(); }

  if (!customElements.get('sb-nav')) customElements.define('sb-nav', SbNav);
  if (!customElements.get('sb-footer')) customElements.define('sb-footer', SbFooter);
})();
