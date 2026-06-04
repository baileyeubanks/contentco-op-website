---
title: Ollama Inference
created: 2026-04-30
updated: 2026-05-01
tags: [ollama, inference, models, local-ai]
---

## Summary

Ollama provides local inference for the Agent OS. It runs on both M2 (primary) and M4 (offload) with a selection of open-weight models.

## M2 Ollama

- **Port**: `*:11434`
- **Process**: `ollama serve` (PID 82078)
- **GUI**: Ollama.app (PID 82064)

### Models

| Model | Size | Quant | Disk |
|-------|------|-------|------|
| `qwen3-coder:30b` | 30.5B | Q4_K_M | ~18.5GB |
| `deepseek-r1:14b` | 14.8B | Q4_K_M | ~8.9GB |
| `qwen3:14b` | 14.8B | Q4_K_M | ~9.2GB |
| `phi4-mini:latest` | 3.8B | Q4_K_M | ~2.4GB |
| `gemma3:4b` | 4.3B | Q4_K_M | ~3.3GB |

## M4 Ollama

- **Port**: `:21434`
- **Purpose**: Offload inference from M2
- **Access**: Via Tailscale `100.75.78.25:21434`

## Hermes Integration

Hermes config points to `http://localhost:11434/v1` with model `llama3.2:3b`. However:
- `llama3.2:3b` is **not** in the pulled models list
- The 4k context window is below Hermes' 64k minimum
- This causes cron job failures

## Recommended Fix

Switch Hermes default model to `qwen3-coder:30b`:
```yaml
# ~/.hermes/config.yaml
default_model: qwen3-coder:30b
api_base: http://localhost:11434/v1
context_length: 32000
```

## Paperclip Integration

Paperclip's inference gateway routes to Ollama as fallback priority:
1. llama.cpp `:11435`
2. Ollama `:11434` ← M2
3. M4 Ollama `:21434`
4. Gemini wrapper `:8765`

## CCNAS Stack

The CCNAS stack includes Prometheus (`:9091`) and Grafana (`:3002`) for Ollama observability.

## Related

- [hermes-control-plane](hermes-control-plane.md) — Hermes config
- [paperclip-governance](paperclip-governance.md) — Inference gateway
- [agent-os-overview](agent-os-overview.md) — Full stack


## Backlinks

- [[agent-os-overview]]
- [[hermes-control-plane]]
- [[index]]
