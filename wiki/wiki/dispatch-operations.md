---
title: Dispatch & Operations
created: 2026-04-30
updated: 2026-05-01
tags: [root, operations, dispatch, crew, work-claims]
---

## Summary

The dispatch and operations system manages crew assignments, work claims, daily handoffs, and project deliverables. It bridges the commercial pipeline (quotes/invoices) with actual production work.

## Concepts

### Work Claims
Tasks that crew members claim and complete. Tracked in `work_claims` table.

```typescript
interface WorkClaim {
  id: string;
  project_id: string;
  title: string;
  description: string;
  claimed_by?: string;
  status: 'open' | 'claimed' | 'in_progress' | 'review' | 'done';
  estimated_hours: number;
  actual_hours?: number;
  due_date: string;
}
```

### Daily Handoffs
End-of-shift reports that capture completed work, blockers, and next steps. Stored in `daily_handoffs`.

### Dispatch Jobs
Active assignments for crew members. Viewed at `/os/dispatch`.

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/os/dispatch/jobs` | Dispatch jobs list |
| GET | `/api/os/handoffs` | Handoffs data |
| GET | `/api/os/work-claims` | Work claims list |
| POST | `/api/os/work-claims/[id]/release` | Release work claim |
| GET | `/api/os/projects` | Projects list |
| GET | `/api/os/projects/[id]` | Project detail |
| GET | `/api/os/projects/[id]/deliverables` | Project deliverables |
| GET | `/api/operations/dispatch` | Operations dispatch data |
| GET | `/api/operations/crew` | Crew data |
| POST | `/api/operations/crew/override` | Crew override |
| GET | `/api/operations/notifications` | Notification feed |

## Crew Management

Crew members are contacts with `role = 'crew'`. The dispatch system:
1. Creates work claims from accepted quotes
2. Crew claims available work
3. Progress tracked via daily handoffs
4. Completed work generates deliverables

## Related

- [quote-invoice-system](quote-invoice-system.md) — Quotes become projects
- [contact-intelligence](contact-intelligence.md) — Crew are contacts
- [marketing-automation](marketing-automation.md) — Campaign deliverables


## Backlinks

- [[index]]
- [[marketing-automation]]
- [[root-overview]]
