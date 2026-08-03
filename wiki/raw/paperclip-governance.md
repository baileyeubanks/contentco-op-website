---
title: Paperclip Governance
created: 2026-04-30
updated: 2026-05-01
tags: [paperclip, agent-os, governance, degraded]
---

## Summary

Paperclip is the governance and execution layer of the Agent OS. It enforces agent boundaries, audits actions, manages memory, and routes inference. Currently **completely down** — server, inference gateway, and LMStudio adapter are all offline.

## Architecture

```
Paperclip Stack:
├── Server (:3100) — Main governance API
├── Inference Gateway (:11436) — Multi-node router
│   ├── llama.cpp (:11435)
│   ├── Ollama (:11434)
│   ├── M4 Ollama (:21434)
│   └── Gemini wrapper (:8765)
├── LMStudio Adapter (:1234 target) — Local inference
├── Governor Executor — Master-agent enforcement
└── Sandbox — Prompt genome + memory + telemetry
```

## Components

### Server
- Bind: `127.0.0.1:3100`
- Exposure: `private`
- Deployment: `local_trusted`
- Embedded Postgres on port `54329`

### Inference Gateway (`bin/inference-gateway.mjs`)
Priority routing:
1. llama.cpp `:11435`
2. Ollama `:11434`
3. M4 Ollama `:21434`
4. Gemini wrapper `:8765`
Exposes unified API at `:11436`

### Governor Executor (`bin/governor-executor.mjs`)
- Only agents named `Chief Executive Officer` may execute
- Calls Gemini wrapper for approval

### LMStudio Adapter (`bin/hermes-local-adapter.mjs`)
- Routes to `http://127.0.0.1:1234/v1/chat/completions`
- Expects model `google/gemma-4-31b`
- **LMStudio is not installed**

### Sandbox (`sandbox/`)
- `genome/`: Prompt files (base, boundary, format, anti-hallucination, efficiency)
- `memory/`: Constitution, lessons, agent memories
- `telemetry-ingestor.mjs`: Metrics collection

## Health Status (Fixed 2026-05-01)

| Component | Status | Notes |
|-----------|--------|-------|
| Inference Gateway | ✅ Up | :11436, routes to Ollama :11434 |
| Agent Executor | ✅ Working | Fixed timeout (120s), model (qwen3-coder:30b), quality gate |
| Ollama Adapter | ✅ Created | `bin/ollama-adapter.mjs` replaces LMStudio-only adapter |
| Gemini Wrapper | ⚠️ Quota exhausted | ~12h reset on `gemini-3-flash-preview` |
| Server (:3100) | ❌ Down | Embedded Postgres governance API not started |
| LMStudio Adapter | ❌ Deprecated | Use `ollama-adapter.mjs` instead |

## Fixes Applied

1. **Inference gateway health checks**: Changed from `/health` to `/api/tags` for Ollama backends
2. **Agent-executor timeout**: 15s → 120s for 30B models
3. **Agent-executor model**: `llama3.2:3b` → `qwen3-coder:30b` (or `qwen3:14b` for speed)
4. **Quality gate**: Fixed `NEAR_EMPTY` bug — was stripping required `[API:...]` and `[COMMENT:...]` action syntax
5. **Ollama adapter**: Created `bin/ollama-adapter.mjs` as drop-in replacement for `hermes-local-adapter.mjs`

## Remaining

- Paperclip server (:3100) needs restart for full governance API
- Gemini wrapper will recover when quota resets (~12h)
- `hermes-local-adapter.mjs` still references LMStudio — update callers to use `ollama-adapter.mjs`

## Restart Procedure

1. Start LMStudio with `google/gemma-4-31b` on port `1234`
2. Start Paperclip server: `node bin/server.mjs` or `paperclip-server.sh`
3. Start inference gateway: `node bin/inference-gateway.mjs`
4. Verify: `curl http://127.0.0.1:3100/health`
5. Restart Cloudflare tunnel `agent-os.yml` for public access

## Related

- [[agent-os-overview]] — Full stack
- [[hermes-control-plane]] — Control plane
- [[deployment-infrastructure]] — Tunneling
