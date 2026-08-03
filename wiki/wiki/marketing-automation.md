---
title: Marketing Automation
created: 2026-04-30
updated: 2026-05-01
tags: [root, marketing, campaigns, automation, briefs]
---

## Summary

Marketing automation manages campaigns, creative briefs, approvals, and automated workflows. It connects inbound marketing (website) with outbound campaigns (email, social).

## Campaigns

Campaigns are marketing initiatives with associated contacts and performance tracking.

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign headers (name, status, budget, dates) |
| `campaign_contacts` | Contacts enrolled in campaign |

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/os/campaigns` | Campaigns list |
| GET | `/api/os/campaigns/[id]` | Campaign detail |
| GET | `/api/os/campaigns/[id]/contacts` | Campaign contacts |
| GET | `/api/os/campaigns/[id]/performance` | Campaign metrics |

## Approvals

Content approvals route through a gated workflow:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/os/approvals` | Approvals list |
| POST | `/api/os/approvals/[id]/decision` | Approve/reject |

## Automations

Declarative automation rules trigger actions based on events:

| Table | Purpose |
|-------|---------|
| `automation_rules` | Rule definitions (trigger, condition, action) |
| `automation_runs` | Execution log |

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/os/automations` | Automations list |
| GET | `/api/os/automations/[id]` | Automation detail |
| POST | `/api/os/automations/[id]/test` | Test automation |

## Marketing Briefs

Marketing-specific briefs are tracked separately from creative briefs:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/os/marketing` | Marketing overview |
| GET | `/api/os/marketing/briefs/[id]` | Marketing brief detail |

## Related

- [creative-brief](creative-brief.md) — Client creative briefs
- [contact-intelligence](contact-intelligence.md) — Campaign contacts
- [dispatch-operations](dispatch-operations.md) — Campaign deliverables


## Backlinks

- [[dispatch-operations]]
- [[index]]
