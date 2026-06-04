---
title: Agent OS Overview
created: 2026-04-30
updated: 2026-05-01
tags: [agent-os, infrastructure, hermes, paperclip, codex]
---

## Summary

The Agent OS is a distributed AI operations stack centered on three nodes: MacBook (operator), M4 Mac Mini (Blaze host/runtime), and cloud services. It orchestrates agents, models, workflows, and business operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  MacBook (Operator Node)                                    │
│  ├── Codex (PID 3566) — Primary IDE / Agent Cockpit        │
│  ├── Hermes Gateway (:8642) — Control plane                 │
│  ├── Hermes Dashboard (:9119) — Web UI                      │
│  ├── Mission Control (:4300) — ROOT OS                      │
│  ├── Content Co-op (:4100) — Next.js dev server            │
│  ├── Ollama (:11434) — Local inference                      │
│  └── Paperclip (:3100) — Governance (DOWN)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SSH / Tailscale
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Blaze.local / M4 Mac Mini (Runtime Authority)              │
│  ├── ACS Website (:8080) — astrocleanings.com               │
│  ├── CCO Subservices (:4101-4104) — root/script/deliver/cut │
│  ├── M4 Ollama (:21434) — Offload inference                 │
│  └── Blaze-V4 API (:8899) — Runtime API                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Cloudflare Tunnels
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Public Internet                                            │
│  ├── astrocleanings.com → Blaze:8080                        │
│  ├── contentco-op.com → MacBook:4100                        │
│  ├── admin.contentco-op.com → MacBook:4300                  │
│  └── *.contentco-op.com → M4:4101-4104                      │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | Role | Status | Port |
|-----------|------|--------|------|
| **Codex** | IDE / Agent cockpit | ✅ Running | — |
| **Hermes** | Control plane | ⚠️ Degraded | 8642 / 9119 |
| **Paperclip** | Governance | ❌ Down | 3100 |
| **Mission Control** | ROOT runtime | ✅ Running | 4300 |
| **Content Co-op** | Public site | ✅ Running | 4100 |
| **Ollama** | Local inference | ✅ Running | 11434 |
| **ACS** | Cleaning service site | ✅ Running | 8080 (M4) |

## Key Issues

1. **Hermes cron broken**: `llama3.2:3b` context window (4k) below Hermes minimum (64k)
2. **Paperclip completely down**: Server, inference gateway, LMStudio adapter all offline
3. **LMStudio not installed**: Scripts expect it at `:1234` with `google/gemma-4-31b`
4. **OpenAI token exhausted**: In `~/.hermes/auth.json`
5. **Mission Control Supabase degraded**: Missing `public.profiles` table

## Related

- [[hermes-control-plane]] — Hermes details
- [[paperclip-governance]] — Paperclip architecture
- [[codex-ide]] — Development environment
- [[deployment-infrastructure]] — M2/M4/Cloudflare
- [[ollama-inference]] — Local model setup
