---
title: Content Co-op Wiki — Master Index
created: 2026-04-30
updated: 2026-05-01
tags: [meta, index, master]
---

## Summary

The canonical knowledge base for Content Co-op, ROOT OS, Agent OS, and Astro Cleanings Services. This wiki is designed for LLM query context — every page is atomic, interlinked, and actionable.

## Domains

### Product & Marketing
- [[homepage]] — Public landing page architecture and sections
- [[portfolio-system]] — Case studies, gallery, and proof media pipeline
- [[product-suite]] — Co-Cut, Co-Script, Co-Deliver product surfaces
- [[creative-brief]] — Client intake form and AI proposal engine
- [[booking-system]] — Public booking and scheduling
- [[client-portal]] — Tokenized client portals for quotes and invoices

### ROOT Admin & Business Logic
- [[root-overview]] — Operator dashboard and admin surface
- [[contact-intelligence]] — CRM: contacts, companies, relationships
- [[quote-invoice-system]] — Quotes, invoices, payments, Stripe integration
- [[dispatch-operations]] — Work claims, crew dispatch, daily handoffs
- [[finance-control]] — Accounts, payables, reconciliation, tax
- [[marketing-automation]] — Campaigns, briefs, approvals, automations

### API & Data Architecture
- [[api-routes]] — Complete API route inventory (40+ endpoints)
- [[database-schema]] — Supabase tables, ROOT ontology, migrations
- [[types-system]] — Shared TypeScript definitions across packages
- [[firebase-integration]] — Firestore collections, CCO admin SDK
- [[stripe-integration]] — Payment flows, webhooks, deposit logic

### Agent OS & Infrastructure
- [[agent-os-overview]] — The full distributed agent stack
- [[hermes-control-plane]] — Gateway, dashboard, cron, skills
- [[paperclip-governance]] — Governance layer (currently degraded)
- [[codex-ide]] — Primary development environment
- [[deployment-infrastructure]] — M2, M4, Cloudflare tunnels, builds
- [[ollama-inference]] — Local models and inference setup

### Astro Cleanings Services
- [[acs-overview]] — Parallel business OS
- [[acs-website]] — Public site and tunnel
- [[acs-admin-portal]] — Admin portal and operations

### Development & Operations
- [[monorepo-structure]] — Apps, packages, services, workspaces
- [[build-deploy-pipeline]] — How we build, ship, and recover
- [[design-system]] — Brand tokens, CSS primitives, components
- [[current-issues]] — Active bugs, degraded services, blockers
- [[rollout-plan]] — 5-phase CCO site rollout (sunspot-wolverine-nova)
- [[development-patterns]] — Coding conventions and architectural decisions

## Using This Wiki

```bash
# Compile
python3 ~/.codex/skills/llm-wiki/scripts/quick-compile.py raw/ wiki/

# Query
python3 ~/.codex/skills/llm-wiki/scripts/wiki-query.py wiki/ "How do I fix the broken deploy?"
```
