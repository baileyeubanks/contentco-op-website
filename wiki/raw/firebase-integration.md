---
title: Firebase Integration
created: 2026-04-30
updated: 2026-05-01
tags: [firebase, firestore, backend, cco]
---

## Summary

Firebase provides a parallel data layer for CCO operations, particularly for lead capture, brief intake, and real-time features. The `cco-firebase-server.ts` library wraps the Firebase Admin SDK for server-side operations.

## Collections

| Collection | Purpose |
|------------|---------|
| `people` | Contact/lead records (mirror of Supabase contacts) |
| `organizations` | Company records |
| `relationships` | Person↔Organization links |
| `auditEvents` | Immutable audit trail |
| `creativeBriefs` | Brief submissions (v3 structured) |
| `handoffs` | System handoff events |
| `emailOutbox` | Queued transactional emails |
| `enrichmentRuns` | Contact enrichment jobs |

## Lead Capture Flow

`POST /api/cco/leads`:
1. Validates input
2. Creates `people/{leadId}` document
3. Creates `organizations/{orgId}` (if company provided)
4. Creates `relationships/{relId}` linking them
5. Creates `auditEvents/{auditId}` for trail
6. Source tracked as `contentco-op.com/brief/lead-first`

## Brief Intake Flow

`POST /api/cco/briefs`:
1. Validates structured intake payload
2. Builds intake transaction via `buildCcoIntakeTransaction()`
3. Commits Firestore batch write
4. Creates handoff event for downstream processing
5. Returns booking URL for discovery call

## Server Library

`lib/cco-firebase-server.ts`:
- Admin SDK initialization with service account
- `commitCcoFirestoreWrites()` — atomic batch writes
- `buildCcoIntakeTransaction()` — transaction builder

## Client Library

`lib/cco-firebase-client.ts`:
- Client SDK for real-time subscriptions
- Used in ROOT dashboard for live data

## Dual Write Pattern

CCO uses both Supabase (canonical) and Firestore (operational):
- **Supabase**: Structured relational data, ROOT queries, reporting
- **Firestore**: Real-time updates, lead capture, event streaming

## Related

- [[creative-brief]] — Brief intake flow
- [[api-routes]] — `/api/cco/*` endpoints
- [[database-schema]] — Supabase schema
- [[contact-intelligence]] — CRM data model
