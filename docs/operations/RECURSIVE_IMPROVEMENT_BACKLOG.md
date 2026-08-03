# Recursive improvement backlog (post-nuke)

Cycle: audit → fix → prove → deploy → re-audit.

## CCO OS (`admin.contentco-op.com` / `/os`)

- [ ] Operator auth works (no 403 allowlist theater) with real os-operator credentials
- [ ] Quotes / invoices / payments issue from one kernel (Schneider handoff)
- [ ] Booking calendar out of `local_preview` when Google FreeBusy configured
- [x] Public `/admin` seed CRM removed (redirects to `/os`)
- [x] `/root` → `/os` permanent redirects
- [ ] Deploy publish-live so live auth callback never returns `0.0.0.0`
- [ ] Deploy scenario-lab resilience

## Co-VideoPro (`co-videopro.com`)

- [x] `admin.contentco-op.com` excluded from CVP host surface (308 → CCO OS)
- [x] Host law documented in DEPLOY_CONTRACT
- [ ] Clear BLOCKERS.md: Supabase env, migrations, real upload/playback spine
- [ ] Brand: no Co‑ProVideo on live deploy
- [ ] `/` front door → welcome (not buried login) when product is ready

## Public `contentco-op.com`

- [ ] Publish staged auth-origin + scenario-lab + nav/footer fixes
- [ ] Dead product DNS: redirect or remove co-* absolute links

## Hygiene

- [x] ROOT/MC archives purged from `archive/repo-preservation`
- [x] kimi `cco-os` marked NON_CANONICAL
- [x] `ops:forbid-root` grep gate
