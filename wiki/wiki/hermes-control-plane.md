---
title: Hermes Control Plane
created: 2026-04-30
updated: 2026-05-01
tags: [hermes, agent-os, control-plane, cron]
---

## Summary

Hermes is the operational control plane for the Agent OS. It provides agent orchestration, session management, skill registry, cron scheduling, and event routing. Runs as a Python service on the MacBook.

## Services

| Service | Port | PID | Status |
|---------|------|-----|--------|
| Gateway | `:8642` | 79008 | ✅ Running (launchd) |
| Dashboard | `:9119` | 50904 | ✅ Running |
| Cron Scheduler | — | — | ❌ Broken |

## Configuration

`~/.hermes/config.yaml`:
- Default model: `llama3.2:3b` via Ollama (`http://localhost:11434/v1`)
- API mode: `openai_compatible`
- Context length: `4096`

## Cron Jobs

| Job | Schedule | Status | Issue |
|-----|----------|--------|-------|
| `workspace-25m-progress-loop` | Every 25m | ❌ Failing | Model context 4k < 64k minimum |
| `mc-ops-checkins` | — | ⏸️ Paused | — |

Cron failure:
```
ValueError: Model llama3.2:3b has a context window of 4,096 tokens,
which is below the minimum 64,000 required by Hermes Agent.
```

## Auth Providers

| Provider | Status | Notes |
|----------|--------|-------|
| OpenAI Codex | ❌ Exhausted | OAuth token invalidated |
| Google Gemini | ✅ OK | OAuth active |
| Kimi (Moonshot) | ✅ OK | API key present |
| OpenRouter | ⚠️ Configured | Key set to literal `lm-studio` |

## Data Stores

- `state.db` (SQLite): Messages, sessions, state
- `response_store.db` (SQLite): Conversations, responses
- `sessions/`: 955 session directories

## Skills

30+ skills in `~/.hermes/skills/`:
- `acs-cco-ops` — Cross-business operations
- `business-financing` — Funding and finance
- `creative` — Creative production
- `data-science` — Analytics and ML
- `devops` — Infrastructure
- `github` — GitHub operations
- `mlops` — Model operations
- `productivity` — Personal productivity
- `research` — Research workflows
- `software-development` — Coding

## Persona

`SOUL.md` defines Hermes as the operational control plane for Bailey Eubanks' business ecosystem, with authority maps for ACS, CCO, CCO OS, CCNAS Stack, and Paperclip.

## Recovery Steps

1. Fix cron: Switch to `qwen3-coder:30b` or `deepseek-r1:14b` (both have larger context)
2. Refresh OpenAI token via OAuth re-auth
3. Verify Ollama connectivity: `curl http://localhost:11434/v1/models`

## Related

- [agent-os-overview](agent-os-overview.md) — Full stack architecture
- [paperclip-governance](paperclip-governance.md) — Governance layer
- [ollama-inference](ollama-inference.md) — Local models


## Backlinks

- [[agent-os-overview]]
- [[codex-ide]]
- [[current-issues]]
- [[index]]
- [[ollama-inference]]
- [[paperclip-governance]]
