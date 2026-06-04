---
title: Deployment Infrastructure
created: 2026-04-30
updated: 2026-05-01
tags: [deployment, infrastructure, cloudflare, m2, m4]
---

## Summary

Content Co-op's deployment infrastructure spans two hardware nodes (M2 MacBook and M4 Mac Mini) connected via Tailscale/SSH, with public exposure via Cloudflare tunnels.

## Hardware Nodes

### M2 MacBook (Operator Node)
- **Location**: Local development machine
- **Services**:
  - Content Co-op Next.js (`:4100`) — `contentco-op.com`
  - Mission Control ROOT OS (`:4300`) — `admin.contentco-op.com`
  - Hermes Gateway (`:8642`)
  - Hermes Dashboard (`:9119`)
  - Ollama (`:11434`)
  - Paperclip (`:3100`) — DOWN

### M4 Mac Mini (Blaze Host / Runtime Authority)
- **Location**: Remote runtime node
- **Tailscale IP**: `100.75.78.25`
- **Services**:
  - ACS Website (`:8080`) — `astrocleanings.com`
  - CCO Root (`:4101`) — `root.contentco-op.com`
  - CCO Script (`:4102`) — `script.contentco-op.com`
  - CCO Deliver (`:4103`) — `deliver.contentco-op.com`
  - CCO Cut (`:4104`) — `cut.contentco-op.com`
  - M4 Ollama (`:21434`)
  - Blaze-V4 API (`:8899`)

## Cloudflare Tunnels

| Tunnel | ID | Hostname | Backend | Running |
|--------|-----|----------|---------|---------|
| ACS Public | `cc9554c5...` | `astrocleanings.com` | `Blaze.local:8080` | ✅ |
| CCO Mission Control | `83bba7f6...` | `contentco-op.com` | `localhost:4100` | ✅ |
| | | `www.contentco-op.com` | `localhost:4100` | ✅ |
| | | `admin.contentco-op.com` | `localhost:4300` | ✅ |
| | | `root.contentco-op.com` | `100.75.78.25:4101` | ✅ |
| | | `script.contentco-op.com` | `100.75.78.25:4102` | ✅ |
| | | `deliver.contentco-op.com` | `100.75.78.25:4103` | ✅ |
| | | `cut.contentco-op.com` | `100.75.78.25:4104` | ✅ |
| Agent OS | `50ec906a...` | `agentos.astrocleanings.com` | `localhost:3100` | ❌ |

## DNS

- Zone: `2365f100818f352b843288fc5af43fb8`
- `contentco-op.com` + `www` → CNAME to M2 tunnel (`83bba7f6...`)
- `astrocleanings.com` + `www` → CNAME to ACS tunnel (`cc9554c5...`)

## Build Process

1. `pnpm build` in `apps/home`
2. Output: `.next/standalone`
3. **Critical**: Kill existing server (`kill -9` if needed)
4. Restart standalone server
5. Verify via `curl -H "Host: contentco-op.com" http://localhost:4100`

## Cache Invalidation

Next.js standalone emits `Cache-Control: s-maxage=31536000`. Must fully restart to invalidate. Cloudflare edge is `DYNAMIC` for HTML.

## Stale Build Risk

M4 still runs old build `94dbab1` on port `4100`. DNS now points to M2, but M4 is a stale liability. SSH to `_mxappservice@100.75.78.25` requires key not available on M2.

## Recovery Runbooks

- `RUNBOOK_BAD_DEPLOY.md` — Bad deploy recovery
- `RUNBOOK_BROKEN_PUBLIC_ROUTE.md` — Route issue recovery
- `DEPLOY_TRIAGE_SYSTEM.md` — Deployment triage procedures

## Related

- [build-deploy-pipeline](build-deploy-pipeline.md) — Build details
- [agent-os-overview](agent-os-overview.md) — Full stack map
- [current-issues](current-issues.md) — Active infrastructure problems


## Backlinks

- [[acs-overview]]
- [[agent-os-overview]]
- [[build-deploy-pipeline]]
- [[current-issues]]
- [[index]]
- [[paperclip-governance]]
- [[product-suite]]
- [[rollout-plan]]
