# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-06-04
**Last session focus**: SSO auth debugging + integration sync fixes

---

## What shipped this session

### Auth bridge — `external_user_id` in responses
Both `validate` (existing user) and `completeRegistration` (new user) now return `external_user_id: claims.sub` alongside the session. The learn platform uses this to query their own tables by the correct OAuth UUID instead of decoding the Protosphere JWT sub (which is a different UUID namespace).

Edge function deployed to both staging and production.

### Integration sync — `external_user_id` param for all auth modes
`syncData` in `supabase-backend.ts` now appends `?external_user_id=<uuid>` for **any** auth mode when `user_integrations.external_user_id` is set (previously only for `auth_bridge`). The `protocode-learn` integration uses `same_domain_cookie` mode, so this fix was needed there too.

Production DB patched directly: `user_integrations.external_user_id = '5028a487-3285-4ecf-8321-64ddc1375208'` for the existing user.

### CI fix
Integration tests excluded from default `test:run` (they require a live Supabase instance and were failing on every CI push). Run explicitly via `npm run test:integration`.

### PRs
- PR #26 merged: TDD foundation + auth-bridge external_user_id + CI fix
- PR #27 open: sync external_user_id for all auth modes (pending merge → triggers production build)

---

## Open architectural debt — integration auth

The `protocode-learn` integration is configured as `same_domain_cookie` but the two platforms have **different UUID namespaces** (Protosphere UUIDs ≠ OAuth/Google UUIDs on the learn side). This is the wrong auth mode for independent platforms. The symptoms were: sync returning all-zeros because the learn endpoint received a Protosphere UUID it couldn't match.

### Architecturally correct target setup

**Login direction** (`auth_bridge`):
- Learn platform redirects user to `chat.protocode.xyz/auth/bridge?token={signed_jwt}`
- JWT `sub` = learn OAuth UUID
- Protosphere creates/links account, stores `user_integrations.external_user_id = claims.sub`
- UUID mapping is explicit and permanent

**Sync direction** (needs both):
1. Send the Protosphere access token as `Authorization: Bearer {token}` — cryptographic proof of who is making the request
2. Also append `?external_user_id={learn_uuid}` — tells the endpoint which learn user to look up

Currently `auth_bridge` sync sends **no Bearer token** (neither `token_exchange` nor `same_domain_cookie` branch fires). This means learn data is queryable by anyone with the API key + any valid UUID — no user-identity proof. Fix: add a third branch in `syncData` for `auth_bridge` that sends the current Protosphere access token as Bearer alongside the `external_user_id` param.

### What needs to happen
1. Merge PR #27 → production dist gets the all-auth-modes fix
2. Switch `protocode-learn` `auth_mode` from `same_domain_cookie` → `auth_bridge` (requires signing key on the integration + learn platform sending signed JWTs)
3. Add Bearer token to `auth_bridge` sync requests in `syncData`
4. Learn platform: wire up their `protosphere-user-data` function to verify the Bearer token OR accept it as proof-of-session alongside `external_user_id`

---

## Cross-subdomain SSO (cookie layer)

`src/lib/supabase.ts` — `makeHybridStorage`: when on `*.protocode.xyz`, writes session to both `localStorage` (origin-scoped) AND a compact cookie at `.protocode.xyz`. Sibling subdomains read the cookie to restore the session.

- Cookie key: `sb-porlhhdajfaamvggcrbi-auth-token` (derived from production Supabase URL)
- Cookie value: full session JSON minus `identities`, `user_metadata`, `app_metadata` (~1.2 KB)
- `typescript.protocode.xyz` needs the same hybrid storage configured to read the cookie into its own localStorage on first load

---

## MCP access

`.mcp.json` defines `supabase-chat-prod` and `supabase-chat-staging` HTTP MCP servers. Requires `SUPABASE_CHAT_TOKEN` (Supabase personal access token) in the OS environment — set via Windows System Properties. Claude Code must be started **after** the env var is set for the MCP to connect.
