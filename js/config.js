/**
 * SquidBay Frontend Configuration
 * F-01: Single source of truth for API_BASE
 * Update this ONE file when the backend URL changes
 */

window.SQUIDBAY_CONFIG = {
    // ── THE CUTOVER LINE ──────────────────────────────────────────────────
    // This must always name the host that ACTUALLY ANSWERS. Verified today:
    //   api.squidbay.io  -> 200
    //   api.squidbay.ai  -> NXDOMAIN (no record exists yet)
    // Pointing this at .ai before the record exists does not "prepare" for the
    // cutover — it breaks every caller the moment it merges, because this one
    // string is where the whole front end gets its API host.
    API_BASE: 'https://api.squidbay.io',

    // Flip to this the moment `dig +short api.squidbay.ai` returns an address
    // and `curl -s -o /dev/null -w '%{http_code}' https://api.squidbay.ai/`
    // returns 200. One line up, one line down — nothing else changes.
    // API_BASE: 'https://api.squidbay.ai',
};
