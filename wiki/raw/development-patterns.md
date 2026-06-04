---
title: Development Patterns
created: 2026-04-30
updated: 2026-05-01
tags: [patterns, conventions, architecture, coding]
---

## Summary

Established patterns and conventions for developing in the Content Co-op monorepo. These guide how we structure code, handle data, and build features.

## App Router Conventions

- Use App Router (`app/` directory) exclusively
- Co-locate API routes with pages (`route.ts` in same folder)
- Use `loading.tsx` and `error.tsx` boundaries
- Server components by default; `'use client'` only when needed

## Data Fetching

### Server Components
```typescript
// Use Supabase server client
import { createServerClient } from '@/lib/supabase-server';

export default async function Page() {
  const supabase = createServerClient();
  const { data } = await supabase.from('contacts').select('*');
  return <ContactList contacts={data} />;
}
```

### Client Components
```typescript
'use client';
import { createBrowserClient } from '@/lib/supabase-browser';

export function ContactForm() {
  const supabase = createBrowserClient();
  // ...
}
```

## API Route Patterns

```typescript
// app/api/resource/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
```

## Component Patterns

### PublicPageLayout
Always wrap public pages:
```tsx
<PublicPageLayout surface="home" theme="dark">
  <main className="page">...</main>
</PublicPageLayout>
```

### CSS Modules
Use CSS Modules for page-specific styles:
```tsx
import styles from './page.module.css';
```

Use global CSS for shared components and design tokens.

## State Management

- **Server state**: Supabase/Firebase queries
- **Client state**: React `useState` / `useReducer` for form state
- **Global state**: Context providers for auth, theme
- **No Redux**: Keep it simple with React primitives

## Form Handling

- Use controlled inputs with `useState`
- Validate on blur and submit
- Show inline errors
- Auto-save drafts to Firestore for multi-step forms

## Error Handling

- API routes return `{ success, data, error }` shape
- Client surfaces show user-friendly messages
- Log errors to console in dev, to service in prod
- Use `error.tsx` boundaries for catastrophic failures

## Testing

- Unit tests with Vitest
- Integration tests with Playwright
- E2E tests for critical paths (brief → quote → payment)

## Git Conventions

- `main` is production
- Feature branches: `feature/description`
- Fix branches: `fix/description`
- Commit messages: Imperative, descriptive
- Squash merge feature branches

## Environment Variables

- `NEXT_PUBLIC_*` — Client-safe
- `SUPABASE_*` — Database
- `STRIPE_*` — Payments
- `FIREBASE_*` — Firestore
- Never commit `.env.local`

## Related

- [[monorepo-structure]] — Directory layout
- [[types-system]] — Type conventions
- [[api-routes]] — API patterns in practice
