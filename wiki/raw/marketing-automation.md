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
| GET | `/api/root/campaigns` | Campaigns list |
| GET | `/api/root/campaigns/[id]` | Campaign detail |
| GET | `/api/root/campaigns/[id]/contacts` | Campaign contacts |
| GET | `/api/root/campaigns/[id]/performance` | Campaign metrics |

## Approvals

Content approvals route through a gated workflow:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/root/approvals` | Approvals list |
| POST | `/api/root/approvals/[id]/decision` | Approve/reject |

## Automations

Declarative automation rules trigger actions based on events:

| Table | Purpose |
|-------|---------|
| `automation_rules` | Rule definitions (trigger, condition, action) |
| `automation_runs` | Execution log |

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/root/automations` | Automations list |
| GET | `/api/root/automations/[id]` | Automation detail |
| POST | `/api/root/automations/[id]/test` | Test automation |

## Marketing Briefs

Marketing-specific briefs are tracked separately from creative briefs:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/root/marketing` | Marketing overview |
| GET | `/api/root/marketing/briefs/[id]` | Marketing brief detail |

## Related

- [[creative-brief]] — Client creative briefs
- [[contact-intelligence]] — Campaign contacts
- [[dispatch-operations]] — Campaign deliverables
