---
title: ROOT Overview
created: 2026-04-30
updated: 2026-05-01
tags: [root, admin, dashboard, operator]
---

## Summary

ROOT is the protected operator surface for Content Co-op. It provides CRM, finance, quotes, invoices, dispatch, system health, and agent management. Accessed at `/root/*` and protected by ROOT login.

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/root/login` | `app/root/login/page.tsx` | ROOT auth entry |
| `/root/overview` | `app/root/overview/page.tsx` | Dashboard overview |
| `/root/contacts` | `app/root/contacts/page.tsx` | Contact intelligence |
| `/root/dispatch` | `app/root/dispatch/page.tsx` | Operations dispatch |
| `/root/finance` | `app/root/finance/page.tsx` | Finance control |
| `/root/quotes` | `app/root/quotes/page.tsx` | Quote management |
| `/root/invoices` | `app/root/invoices/page.tsx` | Invoice management |
| `/root/work-claims` | `app/root/work-claims/page.tsx` | Work claims |
| `/root/system` | `app/root/system/page.tsx` | System health |
| `/root/agents` | `app/root/agents/page.tsx` | Agents panel |
| `/root/marketing` | `app/root/marketing/page.tsx` | Marketing overview |
| `/root/goals` | `app/root/goals/page.tsx` | Goals management |
| `/root/workspace` | `app/root/workspace/page.tsx` | Workspace console |
| `/root/lab` | `app/root/lab/page.tsx` | FSM scenario lab |

## Authentication

ROOT uses a separate auth system from the public site. The `POST /api/root/login` endpoint validates credentials against the `root_users` table in Supabase. Session management via encrypted cookies.

## System Health

The `/root/system` page displays:
- Supabase connection status
- Firebase connection status
- Stripe webhook status
- Hermes/Paperclip connectivity
- Build version and deployment timestamp
- Recent error logs

## Current Issue

Mission Control Supabase shows `degraded` status due to missing `public.profiles` table. This affects user onboarding but not core operations.

## Related

- [[contact-intelligence]] — CRM details
- [[quote-invoice-system]] — Commercial pipeline
- [[dispatch-operations]] — Work management
- [[api-routes]] — All ROOT API endpoints
