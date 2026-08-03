# CCO OS `/os/dispatch` trust — publish receipt (2026-08-03)

## Ship

| Field | Value |
| --- | --- |
| Commit | `0754412a49da6c64d0cf6dfe5ee97eb197014e81` |
| Branch | `cursor/fix-os-dispatch-trust` |
| Runtime | Blaze `~/.contentco-op/home-runtime/releases/0754412a49da` |
| Proof | `https://admin.contentco-op.com/api/runtime-proof` build_id === HEAD |
| :4100 cwd | `CWD_OK` (= `current/apps/home` resolved) |

## Root causes

1. **Jobs API schema drift** — `/api/os/dispatch/jobs` selected non-existent `jobs.client_name` / `service_address` → HTTP 500.
2. **Crew proxy 502** — `/api/operations/crew` returned HTTP 502 when `ACS_ADMIN_TOKEN` missing; Cloudflare replaced the JSON body with plain `error code: 502`, so Map View looked hard-broken.
3. **Off-rail** — `dispatch` `hostVisibility: ["acs"]` only; Overview still linked "Open dispatch" on CCO hosts where MODULES hid it.

## Cleared (live)

- Calendar default loads **60 jobs** in ±window with contact names/addresses (CCO-DB).
- Crew API returns **200 + `degraded: true`** (`missing_acs_admin_token`) — never CF-swallowed 502.
- Dispatch **on MODULES rail** (shortcut D); title **Dispatch** (not ACS Dispatch).
- Live map shows amber honest unavailable copy, not HTTP 502 banner.
- Playwright: `hasDispatchInNav`, `hasHttp502=false`, `hasUsefulState=true`.

## Residual / Bailey

- Set `ACS_ADMIN_TOKEN` on Blaze home-runtime if live crew map should leave degraded mode.
- Cream public parked FAIL still open (copper / suite rainbow / brief craft).

## Evidence

`~/.claude/plans/cco-os-dispatch-trust-evidence/` (`verify.json` + screenshots). Password never written.
