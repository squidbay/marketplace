/**
 * SquidBay Frontend Server
 * Serves static files with real server-side routing for vanity URLs
 * 
 * Security headers via helmet (addresses infra scan findings):
 *   Content-Security-Policy, Strict-Transport-Security, X-Frame-Options,
 *   X-Content-Type-Options, Referrer-Policy, Permissions-Policy
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers — addresses all frontend header findings from infra scan
// CSP allows *.squidbay.io cross-loading (agent.squidbay.io loads scripts from squidbay.io)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https://squidbay.io", "https://*.squidbay.io"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://squidbay.io", "https://*.squidbay.io", "https://cdnjs.cloudflare.com", "https://static.cloudflareinsights.com"],
            // fonts.googleapis.com / fonts.gstatic.com deliberately removed:
            // both faces are self-hosted in /design-system/fonts/, so the site
            // no longer reaches the open web to paint text. Leaving the hosts
            // whitelisted would let a stray @import silently start working
            // again and quietly reintroduce the dependency.
            styleSrc: ["'self'", "'unsafe-inline'", "https://squidbay.io", "https://*.squidbay.io"],
            fontSrc: ["'self'", "https://squidbay.io"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://squidbay.io", "https://api.squidbay.io", "https://squidbay-api-production.up.railway.app", "https://*.squidbay.io", "https://cloudflareinsights.com"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            scriptSrcAttr: ["'unsafe-inline'"]
        }
    },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
        features: {
            camera: [],
            microphone: [],
            geolocation: [],
            payment: ["self"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Static files — serve CSS, JS, images, components
// Shared assets (/js, /css, /components) intentionally get no-store via the
// CORS middleware below — see comment there for why. Images keep normal caching.
const staticOptions = {
    etag: true,
    lastModified: true
};
const imageOptions = {
    maxAge: '7d',
    etag: true,
    lastModified: true
};

// CORS + cache control for *.squidbay.io shared assets.
//
// ROOT CAUSE OF THE INTERMITTENT CORS BUG:
// ----------------------------------------
// The bug: visit squidbay.io first, then click footer link to agent.squidbay.io
// → "blocked by CORS policy" + "Provisional headers are shown" in DevTools.
// Direct visit to agent.squidbay.io works. Hard refresh fixes it. curl always works.
//
// What was happening:
//   1. User visits squidbay.io. Page makes SAME-ORIGIN fetch for /js/components.js.
//      No Origin header → middleware does NOT add ACAO or Vary: Origin.
//      Browser caches the response keyed by URL alone (no Vary).
//   2. User clicks footer → navigates to agent.squidbay.io.
//   3. Agent page loads <script src="https://squidbay.io/js/components.js">
//      as a CROSS-ORIGIN request (Origin: https://agent.squidbay.io).
//   4. Browser checks HTTP cache, finds the entry from step 1, sees no ACAO,
//      blocks the script. "Provisional headers" because the request was
//      satisfied entirely from cache — it never hit the network.
//
// Why curl always worked: curl has no cache.
// Why CDN bypass headers didn't fix it: the cache poisoning was in the user's
// own browser, not Cloudflare or Fastly.
//
// The fix: ALWAYS set Vary: Origin and Cache-Control: no-store on these routes,
// regardless of whether the current request is cross-origin. That way the
// browser never reuses a same-origin cached entry for a cross-origin request.
//
// Tradeoff: parent squidbay.io re-fetches these small JS/CSS files on every
// page load. They are <15KB each, gzipped, behind Cloudflare. Acceptable.
const SQUIDBAY_SUBDOMAIN_RE = /^https:\/\/[a-z0-9-]+\.squidbay\.io$/;
const allowSubdomainCors = (req, res, next) => {
    const origin = req.get('Origin');

    // ALWAYS — even on same-origin requests — to prevent browser cache poisoning.
    res.set('Vary', 'Origin');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('CDN-Cache-Control', 'no-store');             // Cloudflare
    res.set('Cloudflare-CDN-Cache-Control', 'no-store');  // Cloudflare (alternate)
    res.set('Surrogate-Control', 'no-store');             // Fastly (Railway's CDN)
    res.set('Pragma', 'no-cache');                        // Legacy proxies

    // ACAO only on real cross-origin requests from *.squidbay.io subdomains.
    if (origin && SQUIDBAY_SUBDOMAIN_RE.test(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
};

// Apply to all cross-subdomain asset routes the agent page fetches.
app.use('/components', allowSubdomainCors);
app.use('/js', allowSubdomainCors);
app.use('/css', allowSubdomainCors);

app.use('/css', express.static(path.join(__dirname, 'css'), staticOptions));
app.use('/js', express.static(path.join(__dirname, 'js'), staticOptions));
app.use('/images', express.static(path.join(__dirname, 'images'), imageOptions));
app.use('/components', express.static(path.join(__dirname, 'components'), staticOptions));

// SEO & AI Discovery files — serve with correct content types
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').sendFile(path.join(__dirname, 'robots.txt'));
});
app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').sendFile(path.join(__dirname, 'sitemap.xml'));
});
app.get('/llms.txt', (req, res) => {
    res.type('text/plain').sendFile(path.join(__dirname, 'llms.txt'));
});
app.get('/favicon.svg', (req, res) => {
    res.type('image/svg+xml').sendFile(path.join(__dirname, 'favicon.svg'));
});

// Squid Agent subdomain — serve from /agent/ folder
const squidAgentStatic = express.static(path.join(__dirname, 'agent'), staticOptions);
app.use((req, res, next) => {
    if (req.hostname === 'agent.squidbay.io') {
        return squidAgentStatic(req, res, () => {
            // If static file not found, serve index.html (SPA fallback)
            res.sendFile(path.join(__dirname, 'agent', 'index.html'));
        });
    }
    next();
});

// Vanity URL routes — serve the HTML file, JS reads the URL path directly
// Security report must come BEFORE skill detail (Express matches top-down)
app.get('/skill/:agentName/:slug/security', (req, res) => {
    res.sendFile(path.join(__dirname, 'security.html'));
});

app.get('/skill/:agentName/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'skill.html'));
});

app.get('/agent/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'agent.html'));
});

// Clean page URLs (no .html needed)
const pages = ['marketplace', 'register', 'about', 'faq', 'help', 'privacy', 'terms', 'thanks', 'api', 'refund'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, `${page}.html`));
    });
});

// Legacy redirect — /agents moved to /register
app.get('/agents', (req, res) => {
    res.redirect(301, '/register');
});

// Static HTML files (direct access still works)
app.use(express.static(__dirname, {
    extensions: ['html']
}));

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🦑 SquidBay frontend running on port ${PORT}`);
});
