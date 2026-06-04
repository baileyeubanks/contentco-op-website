---
title: Contact Intelligence
created: 2026-04-30
updated: 2026-05-01
tags: [root, crm, contacts, companies, relationships]
---

## Summary

The contact intelligence system is the CRM layer of ROOT. It tracks people, organizations, relationships between them, opportunities, and lifecycle stages. Built on the ROOT ontology in Supabase.

## Data Model

### Core Tables

| Table | Purpose |
|-------|---------|
| `contacts` | People records (name, email, phone, role, location) |
| `companies` | Normalized company records |
| `relationships` | Typed connections (contact ↔ company) |
| `opportunities` | Deal pipeline (value, stage, probability) |
| `contact_business_map` | Junction for multi-business contacts |

### Ontology Types

```typescript
// From @contentco-op/types ontology.ts
interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  lifecycle_stage: LifecycleStage;
}

interface Relationship {
  id: string;
  contact_id: string;
  company_id: string;
  type: 'employee' | 'client' | 'vendor' | 'partner';
  title?: string;
  is_primary: boolean;
}
```

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/root/contacts` | List contacts |
| GET | `/api/root/contacts/[id]` | Contact detail |
| GET | `/api/root/contacts/[id]/timeline` | Contact activity timeline |
| GET | `/api/root/contacts/[id]/relationships` | Contact relationships |
| POST | `/api/root/contacts/enrich` | Enrich contact data |
| POST | `/api/root/contacts/import` | Bulk import contacts |
| POST | `/api/root/contacts/merge` | Merge duplicate contacts |
| POST | `/api/root/contacts/score` | Score lead quality |
| GET | `/api/root/companies` | List companies |
| GET | `/api/root/companies/[id]` | Company detail |

## Enrichment

Contact enrichment pulls from:
- Clearbit (company data)
- Apollo (contact data)
- Manual entry via ROOT UI

## Lead Scoring

The scoring algorithm considers:
- Company size and industry match
- Brief completeness
- Booking intent signal
- Engagement history

## Related

- [[creative-brief]] — Brief creates contacts automatically
- [[quote-invoice-system]] — Quotes linked to contacts
- [[database-schema]] — Full ROOT ontology
