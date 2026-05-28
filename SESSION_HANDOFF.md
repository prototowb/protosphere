# Session Handoff

> **Rolling document.** Replace contents each session — this is "what the next session needs to know," not a permanent log. For long-term project state, see `PROJECT_STATUS.md`.

**Updated**: 2026-05-29
**Last session focus**: Productionising the Protocode Learn integration + cross-subdomain auth + deploy hygiene

---

## What shipped this session

| PR | Outcome |
|---|---|
| [#19](https://github.com/prototowb/protosphere/pull/19) | CI publishes built dist to orphan `dist-development` / `dist-main` branches via force-push. Source branches no longer carry build artifacts in PR diffs. |
| [#20](https://github.com/prototowb/protosphere/pull/20) | (Superseded) Initial chunked cookie storage — added auth, but bloated request headers. |
| [#21](https://github.com/prototowb/protosphere/pull/21) | Hybrid auth storage: full session in `localStorage`, compact session (no `identities`/`metadata`) in `.protocode.xyz` cookie. Fixes Apache 400s from Netcup's `LimitRequestFieldSize`. |
| [#22](https://github.com/prototowb/protosphere/pull/22) | Lazy TTL refresh in `useUserIntegrations` — stale-while-revalidate, 300s default. Integration data auto-refreshes in background. |
| [#23](https://github.com/prototowb/protosphere/pull/23) | Release: hybrid auth + TTL refresh + orphan deploys → chat.protocode.xyz (prod). Netcup reconfigured to pull `dist-main`. |
| [#24](https://github.com/prototowb/protosphere/pull/24) | Untrack `dist/` from `development` and `main` (open). |

**Schema migrations applied to chat (prod)**:
- 050–053 (integrations framework + `api_key` + `app_url` + auth bridge) applied via Supabase Management API + PAT inside a subagent
- Integration creation on chat.protocode.xyz now works end-to-end

**Netcup config**:
- `staging-chat.protocode.xyz` → pulls `dist-development`
- `chat.protocode.xyz` → pulls `dist-main`

---

## Active / pending

- **PR #24** — review + merge to development → main
- After #24 merges to main, the `dist/` tree disappears from both source branches entirely. Verify Netcup still serves correctly (it should — Netcup pulls `dist-main`, not `main`).

## Conventions established this session — keep going forward

### Branch flow
- **Every development → main merge goes through a PR.** No direct local merges.
- Feature branches → development → main, via PR each step.

### Deploy model
- Source branches never contain `dist/`.
- CI build-dist workflow force-pushes the build to `dist-${ref}` orphan branches.
- Netcup pulls the orphan branch directly.

### Cross-subdomain auth on `.protocode.xyz`
- Hybrid storage (`src/lib/supabase.ts`):
  - `localStorage` — full session for this origin
  - `.protocode.xyz` cookie — compact session (no `identities`/`metadata`) for sibling subdomains
- The learning platform's auth-bridge reads the cookie, calls the **`protosphere-sso-exchange`** Edge Function on learn's Supabase, gets a learn-native session in exchange, and `setSession()`s with that. Supabase doesn't natively trust JWTs from another Supabase project, hence the exchange.

### Supabase MCP setup (cross-org, simultaneous access)
- Per-repo `.mcp.json` (gitignored), PAT in `Authorization: Bearer ${SUPABASE_CHAT_TOKEN}` header.
- Two servers in this repo: `supabase-chat-prod` (porlhhdajfaamvggcrbi) and `supabase-chat-staging` (pysitxxjzejhvkawacit).
- Use `${VAR}` syntax for env expansion (`$VAR` is treated as a literal).
- Set tokens at Windows User scope and launch Claude Code from a fresh PowerShell to inherit them.

---

## How to use this file

- **End of session**: replace the contents with the new state. Keep it short (~150 lines max).
- **Start of next session**: read this file first.
- **Don't append history** — `git log` is the audit trail. This file is "what's true right now."
