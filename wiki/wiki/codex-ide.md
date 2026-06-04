---
title: Codex IDE
created: 2026-04-30
updated: 2026-05-01
tags: [codex, ide, agent-os, development]
---

## Summary

Codex is the primary development environment and agent cockpit. It's an Electron app running OpenAI's Codex CLI with multi-agent support, MCP integration, screen chronicle, and persistent memory.

## Configuration

`~/.codex/config.toml`:
- Model: `gpt-5.5`
- Reasoning effort: `medium`
- Personality: `pragmatic`
- Multi-agent: `true`
- MCP client: `true`
- Memories: `true`
- Chronicle: `true`

## MCP Servers

| Server | Endpoint | Purpose |
|--------|----------|---------|
| Figma | `https://mcp.figma.com/mcp` | Design-to-code |

## Plugins

OpenAI curated plugins enabled:
- gmail, github, google-calendar, stripe
- build-web-apps, build-ios-apps, build-macos-apps
- hugging-face, google-drive, computer-use
- vercel, browser-use, cloudflare
- documents, spreadsheets, presentations
- superpowers, remotion, hyperframes, linear

## Skills

36 skills in `~/.codex/skills/`:
- `paperclip` — Paperclip integration
- `paperclip-create-agent` — Agent creation
- `para-memory-files` — Memory management
- `chronicle` — Screen capture and history
- `doc` — Document editing
- `figma` — Design implementation
- `gh-address-comments` — GitHub PR comments
- `gh-fix-ci` — CI debugging
- `imagegen` — Image generation
- `jupyter-notebook` — Notebook creation
- `linear` — Ticket management
- `netlify-deploy` — Netlify deployment
- `notion-*` — Notion integrations
- `openai-docs` — Documentation lookup
- `pdf` — PDF processing
- `playwright` — Browser automation
- `render-deploy` — Render deployment
- `screenshot` — Desktop screenshots
- `security-*` — Security analysis
- `sentry` — Error tracking
- `sora` — Video generation
- `speech` — Text-to-speech
- `transcribe` — Audio transcription
- `sms-communications` - SMS/voice
- `vercel-deploy` — Vercel deployment

## Automations

15 automations in `~/.codex/automations/`:
- `cco-drift-review` — Site drift detection
- `cco-intake-audit` — Brief intake auditing
- `hermes-daily-upgrade` — Hermes maintenance
- `inference-report-am/pm` — Inference health reports
- `morning-control-brief` — Daily briefing
- `overnight-relay` — Nightly processing
- `blocker-sweeper` — Blocker resolution

## State

- `state_5.sqlite`: Agent jobs, threads, goals, tool bindings
- `logs_2.sqlite`: Large log database (~479MB)
- `worktrees/`: 74 Git worktrees
- `memories/`: Persistent memory storage

## Screen Chronicle

3 `codex_chronicle` processes capture displays 5, 12, and 14. High CPU usage (~15% each). Provides hours of screen history for context.

## Related

- [agent-os-overview](agent-os-overview.md) — Full stack
- [hermes-control-plane](hermes-control-plane.md) — Control plane integration
- [development-patterns](development-patterns.md) — How we build


## Backlinks

- [[agent-os-overview]]
- [[index]]
