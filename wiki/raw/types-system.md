---
title: Types System
created: 2026-04-30
updated: 2026-05-01
tags: [typescript, types, packages, shared]
---

## Summary

`@contentco-op/types` is the shared TypeScript package that provides canonical type definitions for the entire monorepo. It exports from three sub-modules plus inline creative brief types.

## Package Structure

```
packages/types/
├── src/
│   ├── index.ts          # Re-exports everything
│   ├── ontology.ts       # ROOT CRM/ontology types
│   ├── platform.ts       # Platform manifest & runtime types
│   └── workflow.ts       # Workflow state machine types
├── package.json
└── tsconfig.json
```

## Ontology Types (`ontology.ts`)

CRM and business entity types:

```typescript
export interface Company { id: string; name: string; domain?: string; industry?: string; size?: string; lifecycle_stage: LifecycleStage; }
export interface Relationship { id: string; contact_id: string; company_id: string; type: 'employee' | 'client' | 'vendor' | 'partner'; title?: string; is_primary: boolean; }
export interface Opportunity { id: string; company_id: string; contact_id: string; title: string; value: number; stage: string; probability: number; expected_close: string; }
export interface Project { id: string; opportunity_id?: string; title: string; status: string; start_date?: string; end_date?: string; budget?: number; }
export interface Deliverable { id: string; project_id: string; title: string; type: string; status: string; url?: string; }
export interface Campaign { id: string; name: string; status: string; budget?: number; start_date?: string; end_date?: string; }
export interface CampaignContact { campaign_id: string; contact_id: string; enrolled_at: string; status: string; }
export interface Payment { id: string; invoice_id: string; amount: number; method: string; stripe_id?: string; paid_at: string; }
export interface CatalogItem { id: string; name: string; category: string; description?: string; unit_price: number; unit: string; }
export interface AutomationRule { id: string; name: string; trigger: string; condition: Record<string, unknown>; action: Record<string, unknown>; active: boolean; }
export interface AutomationRun { id: string; rule_id: string; triggered_at: string; status: string; result?: Record<string, unknown>; }
```

## Platform Types (`platform.ts`)

```typescript
export interface PlatformManifest { surfaces: PlatformSurface[]; modules: PlatformModule[]; version: string; }
export interface PlatformSurface { id: string; name: string; path: string; auth_required: boolean; }
export interface PlatformModule { id: string; name: string; version: string; dependencies: string[]; }
export interface RuntimeConfig { environment: string; features: Record<string, boolean>; dependencies: ServiceDependencyDefinition[]; }
```

## Workflow Types (`workflow.ts`)

```typescript
export interface WorkflowState { id: string; entity_type: string; entity_id: string; state: string; entered_at: string; }
export interface WorkflowTransition { from_state: string; to_state: string; trigger: string; guard?: string; }
export interface DeadLetterRecord { id: string; event: PlatformEvent; error: string; retried_at?: string[]; }
```

## Creative Brief Types (inline in `index.ts`)

```typescript
export interface CreativeBriefFormData { contact_name: string; contact_email: string; phone?: string; company?: string; role?: string; location?: string; content_type: string; deliverables: string[]; audience?: string; tone?: string; deadline?: string; objective?: string; key_messages?: string; references?: string; constraints?: string; }
export interface CreativeDiagnosticInput { goal: string; audience: string; placement: string; runtime: string; budget: string; }
export interface CreativeBriefSubmissionPayloadV3 { intake: CreativeBriefStructuredIntake; diagnostic: CreativeDiagnosticInput; contact: { name: string; email: string; phone?: string; company?: string; }; }
export interface CreativeBriefStructuredIntake { contact: { name: string; email: string; phone?: string; company?: string; role?: string; location?: string; }; project: { content_type: string; deliverables: string[]; objective?: string; key_messages?: string; references?: string; constraints?: string; }; routing: { source_surface: string; source_path: string; submission_mode: string; }; readiness: { booking_intent?: string; deadline?: string; budget?: string; }; }
export interface CreativeBriefHandoffEnvelope { brief_id: string; submitted_at: string; contact: CreativeBriefStructuredIntake['contact']; project_summary: string; diagnostic_signals: CreativeDiagnosticInput; routing: CreativeBriefStructuredIntake['routing']; quote_draft?: { items: Array<{ description: string; quantity: number; rate: number; }>; total: number; }; proposal_pdf_url?: string; next_actions: string[]; }
```

## Transpiled Packages

The following packages are transpiled in `apps/home/next.config.ts`:
- `@contentco-op/ui`
- `@contentco-op/brand`
- `@contentco-op/types`
- `@contentco-op/identity-access`
- `@contentco-op/pricing`

## Related

- [[database-schema]] — SQL schema these types map to
- [[monorepo-structure]] — Package architecture
- [[api-routes]] — API contracts using these types
