/**
 * SquidBot chat — Cloudflare Worker.
 *
 * Rebuild brick #1: the first SquidBay service that runs on Cloudflare with no
 * Railway involvement at all. Replaces POST /chat on squidbay-api.
 *
 * Path: browser -> this Worker -> Anthropic. The hop in the middle is chosen at
 * runtime, and which one you get is a RULING, not a preference:
 *
 *   CF_ACCOUNT_ID and CF_GATEWAY_ID both set  -> Cloudflare AI Gateway
 *   either one unset (the factory default)    -> https://api.anthropic.com direct
 *
 * SquidBot is a FACTORY agent, and the operator's 2026-08-11 ruling
 * (ECOSYSTEM-UPDATE-PLAN §3, plane 1) is that the factory plane never routes
 * through the Gateway — only personal agents (Kraken) do. So both vars are
 * deliberately absent from wrangler.toml, the live Worker has had them unset
 * since 15:32Z on 2026-08-11, and /health reports "path":"anthropic-direct".
 * Setting them changes which plane SquidBot runs on; that needs an operator
 * ruling, not a config edit. The deploy workflow's parity guard enforces this.
 *
 * /health echoes the live choice as `path` ("anthropic-direct" | "ai-gateway").
 * The deploy workflow reads that exact field, before and after shipping, to
 * prove a deploy did not move SquidBot off the ruled plane.
 *
 * The Anthropic key lives ONLY as a Worker secret. It is never in this file,
 * never in wrangler.toml, never sent to the browser, and never echoed in an
 * error. The browser talks to this Worker; only this Worker talks to Anthropic.
 *
 * Secrets (set with `wrangler secret put <NAME>`, never committed):
 *   CLAUDE_API_KEY               — Anthropic key, forwarded as x-api-key
 *   CLOUDFLARE_AI_GATEWAY_TOKEN  — OPTIONAL. Only needed if the gateway has
 *                                  Authenticated Gateway switched on. Kept
 *                                  strictly separate from any broad Cloudflare
 *                                  API token: that split is a security
 *                                  boundary, not a preference.
 * Vars (wrangler.toml, not secret — these are identifiers, not credentials):
 *   ALLOWED_ORIGINS, MODEL
 *   CF_ACCOUNT_ID, CF_GATEWAY_ID — deliberately NOT in wrangler.toml. Read the
 *   path block above before adding them; they are the plane switch.
 */

const ANTHROPIC_VERSION = '2023-06-01';

// Input caps. A chat endpoint that will take anything is an invitation to pay
// for someone else's inference.
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOTAL_CHARS = 24000;
const MAX_TOKENS_OUT = 1024;

const SYSTEM_PROMPT = [
  'You are SquidBot, SquidBay\'s Chief Squid Officer — the assistant on squidbay.ai.',
  '',
  'SquidBay is a marketplace where AI agents buy and sell skills from each other.',
  'Any agent can sell; buying requires a squid agent. Payments run on Stripe',
  'Connect v2 and sellers keep 90%. Skills are scanned for security before they',
  'can sell. Agents have names that lock permanently once claimed, and carry',
  'reputation across every transaction.',
  '',
  'Be brief and concrete — two or three sentences unless asked for more. Answer',
  'as a knowledgeable member of the team, not a support macro. If you do not know',
  'something about SquidBay, say so plainly and point at /docs or /support rather',
  'than inventing a detail. Never claim a feature exists because it sounds likely.',
].join('\n');

function corsHeaders(origin, allowed) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Accept only what the widget actually sends, and normalise it.
 * Returns { messages } or { error }.
 */
function validate(payload) {
  if (!payload || typeof payload !== 'object') return { error: 'Body must be a JSON object.' };
  const { messages } = payload;
  if (!Array.isArray(messages)) return { error: 'Expected { messages: [...] }.' };
  if (messages.length === 0) return { error: 'No messages supplied.' };
  if (messages.length > MAX_MESSAGES) return { error: 'Conversation too long. Start a new one.' };

  let total = 0;
  const clean = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { error: 'Malformed message.' };
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    if (!role) return { error: 'Each message needs role "user" or "assistant".' };
    if (typeof m.content !== 'string') return { error: 'Message content must be a string.' };
    const content = m.content.trim();
    if (!content) continue;
    if (content.length > MAX_CHARS_PER_MESSAGE) return { error: 'Message too long.' };
    total += content.length;
    if (total > MAX_TOTAL_CHARS) return { error: 'Conversation too long. Start a new one.' };
    clean.push({ role, content });
  }
  if (clean.length === 0) return { error: 'No messages supplied.' };
  // Anthropic requires the first message to be from the user.
  if (clean[0].role !== 'user') clean.shift();
  if (clean.length === 0) return { error: 'No messages supplied.' };
  return { messages: clean };
}

export default {
  async fetch(request, env, ctx) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      // Deliberately reports only whether config is PRESENT, never any value.
      return json({
        service: 'squidbot-chat',
        ok: true,
        configured: {
          claudeKey: Boolean(env.CLAUDE_API_KEY),
          gatewayToken: Boolean(env.CLOUDFLARE_AI_GATEWAY_TOKEN),
          accountId: Boolean(env.CF_ACCOUNT_ID),
          gatewayId: Boolean(env.CF_GATEWAY_ID),
        },
        model: env.MODEL || null,
        path: env.CF_ACCOUNT_ID && env.CF_GATEWAY_ID ? 'ai-gateway' : 'anthropic-direct',
      }, 200, cors);
    }

    if (request.method !== 'POST' || (url.pathname !== '/chat' && url.pathname !== '/')) {
      return json({ error: 'Not found.' }, 404, cors);
    }

    if (origin && allowed.length && !allowed.includes(origin)) {
      return json({ error: 'Origin not allowed.' }, 403, cors);
    }

    // The key is the ONLY hard requirement. CF_ACCOUNT_ID / CF_GATEWAY_ID are
    // optional by design: absent means the direct path, which is the ruled
    // factory plane. Hard-requiring them here is what made an earlier revision
    // 503 on exactly the configuration the operator ruled correct.
    if (!env.CLAUDE_API_KEY) {
      console.error('[squidbot] CLAUDE_API_KEY not set');
      return json({ error: 'SquidBot is not configured yet.' }, 503, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Body must be valid JSON.' }, 400, cors);
    }

    const v = validate(payload);
    if (v.error) return json({ error: v.error }, 400, cors);

    // The plane switch. See the header block: unset vars = the ruled factory path.
    const useGateway = Boolean(env.CF_ACCOUNT_ID && env.CF_GATEWAY_ID);
    const upstreamUrl = useGateway
      ? `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/anthropic/v1/messages`
      : 'https://api.anthropic.com/v1/messages';

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    };
    // Only sent when the gateway actually requires it. An unauthenticated
    // gateway rejects nothing; an authenticated one 401s without this.
    if (env.CLOUDFLARE_AI_GATEWAY_TOKEN) {
      headers['cf-aig-authorization'] = `Bearer ${env.CLOUDFLARE_AI_GATEWAY_TOKEN}`;
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: env.MODEL || 'claude-sonnet-5',
          max_tokens: MAX_TOKENS_OUT,
          system: SYSTEM_PROMPT,
          messages: v.messages,
        }),
      });
    } catch (e) {
      console.error(`[squidbot] upstream unreachable (${useGateway ? 'gateway' : 'direct'}):`, e.message);
      return json({ error: 'SquidBot is having a moment. Try again.' }, 502, cors);
    }

    const raw = await upstream.text();

    if (!upstream.ok) {
      // Logged for the operator, NEVER returned: upstream bodies can echo
      // request headers, and the request headers contain the API key.
      console.error(`[squidbot] upstream ${upstream.status}: ${raw.slice(0, 400)}`);
      const hint =
        upstream.status === 401 || upstream.status === 403
          ? 'SquidBot is not authorised right now.'
          : upstream.status === 429
            ? 'SquidBot is busy. Try again in a moment.'
            : 'SquidBot is having a moment. Try again.';
      return json({ error: hint }, upstream.status === 429 ? 429 : 502, cors);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error('[squidbot] non-JSON from gateway:', raw.slice(0, 200));
      return json({ error: 'SquidBot is having a moment. Try again.' }, 502, cors);
    }

    const text = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
      : '';

    if (!text) {
      console.error('[squidbot] empty completion:', JSON.stringify(data).slice(0, 300));
      return json({ error: 'SquidBot had nothing to say. Try rephrasing.' }, 502, cors);
    }

    // `response` is the field the existing widget reads (components/chatbot.js).
    return json({ response: text }, 200, cors);
  },
};
