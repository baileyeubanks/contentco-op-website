---
title: Current Issues
created: 2026-04-30
updated: 2026-05-01
tags: [issues, bugs, blockers, degraded]
---

## Summary

Active issues across the Content Co-op system, Agent OS, and infrastructure. This is a living document of what's broken and what needs attention.

## Critical

### 1. Hermes Cron Broken
- **Symptom**: `workspace-25m-progress-loop` fails every 25 minutes
- **Error**: `llama3.2:3b context window 4,096 < 64,000 minimum`
- **Impact**: No automated progress reports
- **Fix**: Switch to `qwen3-coder:30b` in `~/.hermes/config.yaml`

### 2. Paperclip Completely Down
- **Symptom**: All governance services offline
- **Components**: Server, inference gateway, LMStudio adapter
- **Impact**: No agent enforcement, no audit trail, no quality gates
- **Fix**: Install LMStudio, start Paperclip server + gateway

### 3. LMStudio Not Installed
- **Symptom**: Scripts expect LMStudio at `:1234` with `gemma-4-31b`
- **Impact**: Breaks Paperclip local inference path
- **Fix**: Install LMStudio, download `google/gemma-4-31b`

### 4. M4 Stale Build
- **Symptom**: Old build `94dbab1` still running on M4 port `4100`
- **Impact**: Resource consumption, potential confusion
- **Fix**: SSH to M4, kill process, update working tree or decommission
- **Blocker**: SSH key not available on M2

## High

### 5. CCO OS Supabase Degraded
- **Symptom**: Missing `public.profiles` table
- **Impact**: User onboarding affected
- **Fix**: Run missing migration

### 6. OpenAI Token Exhausted
- **Symptom**: `auth.json` shows OpenAI token invalidated
- **Impact**: Cannot use OpenAI models via Hermes
- **Fix**: Re-authenticate OpenAI in Hermes

### 7. Brief Page Incomplete (Phase 3)
- **Symptom**: Card-select UI not wired, no auto-save, no live estimate
- **Impact**: Client experience degraded
- **Fix**: Implement card-select, gradient progress, auto-save, AI proposal flow

### 8. Cross-Page Polish Incomplete (Phase 4)
- **Symptom**: Font fixes, background consistency, inline style audit pending
- **Impact**: Visual inconsistencies across public pages
- **Fix**: Complete Phase 4 rollout items

## Medium

### 9. Codex Chronicle High CPU
- **Symptom**: 3 screen capture processes at ~15% CPU each
- **Impact**: Battery drain, fan noise
- **Fix**: Reduce capture frequency or disable on battery

### 10. Node Version Mismatch
- **Symptom**: Active Node v22.22.0, package.json expects 20.x
- **Impact**: Potential compatibility issues
- **Fix**: Align versions or test compatibility

### 11. Git Divergence
- **Symptom**: `main` 20 ahead, 78 behind `m4tmp/main`
- **Impact**: Risk of merge conflicts, lost work
- **Fix**: Reconcile branches, determine canonical branch

## Monitoring

- Hermes dashboard: `http://localhost:9119`
- CCO OS system health: `https://admin.contentco-op.com/os/system`
- Cloudflare dashboard: Zone `2365f100818f352b843288fc5af43fb8`

## Related

- [rollout-plan](rollout-plan.md) — Active work phases
- [deployment-infrastructure](deployment-infrastructure.md) — Infrastructure issues
- [agent-os-overview](agent-os-overview.md) — Full system health
- [hermes-control-plane](hermes-control-plane.md) — Hermes issues
- [paperclip-governance](paperclip-governance.md) — Paperclip issues


## Backlinks

- [[build-deploy-pipeline]]
- [[deployment-infrastructure]]
- [[index]]
- [[rollout-plan]]
