# SquidBot chat Worker

SquidBot is the assistant on [squidbay.ai](https://squidbay.ai). This Worker is what it talks to.

The chat button on every page posts the conversation here. The Worker adds the system prompt, calls Anthropic, and returns the reply. It runs on Cloudflare, so the API key stays server-side and never reaches a browser.

```
browser  ->  squidbot-chat Worker  ->  Anthropic
```

Nothing in this directory is a credential. The key is a Worker secret: encrypted at rest, never in the repository, never in `wrangler.toml`, and not readable back out once set. It can only be replaced.

## Configuration

Vars in `wrangler.toml` are identifiers, not credentials.

| Var | Meaning |
|---|---|
| `MODEL` | The Anthropic model id this Worker calls. |
| `ALLOWED_ORIGINS` | Comma-separated origin allowlist. The widget is public, so the endpoint is public. This is what keeps it answering only the surfaces we ship. |

Secrets are set with `wrangler secret put` and never committed.

| Secret | Required | Meaning |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Forwarded to Anthropic as `x-api-key`. |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | Only when the gateway is set to Authenticated | Sent as `cf-aig-authorization`. Deliberately a separate, narrow credential from any broad Cloudflare API token. The split is the security boundary. |

`CF_ACCOUNT_ID` and `CF_GATEWAY_ID` are deliberately unset. With both set, the Worker routes through a Cloudflare AI Gateway. Unset, it calls Anthropic directly, which is how the deployed Worker runs. Setting them changes which path SquidBot runs on, so it is a decision to take deliberately, not a config tidy-up.

## Deploy

```bash
cd workers/squidbot-chat
npx wrangler deploy
npx wrangler secret put CLAUDE_API_KEY
```

Merges to `main` deploy this Worker automatically. See `.github/workflows/deploy.yml` in the repository root.

## Endpoints

- `POST /chat` takes `{messages:[{role,content}]}` and returns `{response:"..."}`. On failure it returns `{error:"..."}` with a message a person can read.
- `GET /health` reports whether each piece of configuration is present. It never returns a value, so it is safe to curl in front of anyone.

## Deliberate choices

- **Upstream error bodies are logged, never returned.** A gateway error can echo the request headers back, and the request headers carry the API key.
- **Input is capped**: 20 messages, 4,000 characters each, 24,000 total. An uncapped chat endpoint is an invitation to pay for someone else's inference.
- **Configuration is checked before the body is parsed**, so a misconfigured Worker answers 503 immediately instead of starting work it cannot finish.

## Not here yet

Per-IP rate limiting, which needs KV or a Durable Object. Conversation persistence. The fuller personality and memory files SquidBot loads elsewhere. This Worker carries a concise system prompt instead.
