# squidbot-chat — Cloudflare Worker

Rebuild brick #1. The first SquidBay service running entirely on Cloudflare,
with no Railway involvement. Replaces `POST /chat` on `squidbay-api`.

```
browser  ->  squidbot-chat Worker  ->  Cloudflare AI Gateway  ->  Anthropic
```

## Why a Worker and not a Railway route

The Anthropic key must never reach the browser, so something server-side has to
hold it. On Workers that something is a Worker secret: encrypted at rest, never
in the repo, never in `wrangler.toml`, never readable back out — only replaced.

## Configuration

**Vars** (`wrangler.toml` — identifiers, not credentials; useless without a key):

| var | meaning |
|---|---|
| `CF_ACCOUNT_ID` | Cloudflare account that owns the gateway |
| `CF_GATEWAY_ID` | AI Gateway slug |
| `MODEL` | Anthropic model id |
| `ALLOWED_ORIGINS` | comma-separated origin allowlist |

**Secrets** (`wrangler secret put` — never committed, never logged):

| secret | required | meaning |
|---|---|---|
| `CLAUDE_API_KEY` | yes | forwarded to Anthropic as `x-api-key` |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | only if the gateway is set to **Authenticated** | sent as `cf-aig-authorization` |

The gateway token is deliberately a *separate, narrow* credential from any broad
Cloudflare API token. Per `specs/hq/CF-MIGRATION-ENV-INVENTORY.md`: "Never
collapse with the AI-Gateway token — the split is the security boundary."

## Deploy

```bash
cd workers/squidbot-chat
npx wrangler deploy
npx wrangler secret put CLAUDE_API_KEY
```

## Endpoints

- `POST /chat` — `{messages:[{role,content}]}` → `{response:"..."}`. On failure
  `{error:"..."}` with a human-readable message.
- `GET /health` — reports whether each piece of config is **present**. It never
  returns a value, so it is safe to curl in front of anyone.

## Deliberate choices

- **Upstream error bodies are logged, never returned.** A gateway error can echo
  the request headers back, and the request headers contain the API key.
- **Input is capped** (20 messages, 4k chars each, 24k total). An uncapped chat
  endpoint is an invitation to pay for someone else's inference.
- **Config is checked before the body is parsed**, so a misconfigured Worker
  answers 503 immediately instead of doing work it cannot finish.

## Not in this brick

Per-IP rate limiting (wants KV or a Durable Object), conversation persistence,
and the SquidBot "mind folder" — the soul/identity/personality/memory files the
Railway version loads. This brick carries a concise system prompt instead. All
three are mapped in `specs/hq/FRONTEND-MAP-INVENTORY-2026-08-10.md`.
