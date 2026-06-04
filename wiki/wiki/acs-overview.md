---
title: Astro Cleanings Services Overview
created: 2026-04-30
updated: 2026-05-01
tags: [acs, business, astrocleanings, parallel]
---

## Summary

Astro Cleanings Services (ACS) is the parallel business to Content Co-op. It provides residential and commercial cleaning services in the Chicago area. ACS shares infrastructure with CCO but has separate codebases, branding, and operations.

## Public Site

- **URL**: `https://astrocleanings.com`
- **Backend**: `Blaze.local:8080` (M4 Mac Mini)
- **Tunnel**: Cloudflare `acs-public.yml` (`cc9554c5...`)
- **Tech**: Node.js server

## Admin Portal

- **URL**: `https://admin.astrocleanings.com`
- **Code**: `astrocleanings-admin/` (full admin dashboard)
- **Features**: Scheduling, crew management, quotes, invoices

## Business OS

- **Code**: `acs-business-os-demo/` (Next.js demo)
- **Onboarding**: `astro-cleaning-onboarding/`
- **Operations**: `acs-os-admin/`

## Shared Infrastructure

ACS and CCO share:
- Cloudflare account and DNS zone
- Tailscale network
- M4 Mac Mini (Blaze host)
- Hermes control plane (for agent operations)
- Paperclip governance (when running)

## Brand

ACS brand assets in `contentco-op/brand/assets/acs/`:
- Icons, logos, motion graphics
- Photography (crew photos, hero videos)
- Design tokens distinct from CCO

## Hermes Authority Map

Hermes `SOUL.md` grants ACS equal authority with CCO:
1. ACS — `astrocleanings.com`, Blaze.local:8080
2. CCO — `contentco-op.com`, Blaze.local:4100
3. Mission Control — Port 4300
4. CCNAS Stack — Open WebUI, Chroma, Ollama, Prometheus, Grafana
5. Paperclip — `http://127.0.0.1:3100`

## Related

- [deployment-infrastructure](deployment-infrastructure.md) — Shared tunnels and M4
- [agent-os-overview](agent-os-overview.md) — Shared agent stack
- [finance-control](finance-control.md) — Cross-business accounting


## Backlinks

- [[finance-control]]
- [[index]]
