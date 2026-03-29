# Content Co-op Monorepo Route Map

This route map documents the current deploy artifact at
`/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home`.
It is the current shared Coolify artifact for both `CCO HOME` and `ROOT`.

Verified on March 10, 2026 by running:

```bash
cd /Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo
npm run build -w @contentco-op/home
```

## Canonical Deploy Boundary

- Canonical repo for the shared app artifact: `contentco-op/monorepo`
- Canonical app artifact: `apps/home`
- Public product surface: `CCO HOME`
- Protected operator surface: `ROOT`
- Transitional legacy aliases: `/dashboard/*` redirects into `/root/*`

## Delivery Contract

- Current live deploy mode: Coolify GitHub/Dockerfile source build on the NAS
- Preferred next deploy mode: GitHub Actions builds and publishes `ghcr.io/baileyeubanks/contentco-op-home`
- Tracking tag: `ghcr.io/baileyeubanks/contentco-op-home:main`
- Immutable tag pattern: `ghcr.io/baileyeubanks/contentco-op-home:sha-<git sha>`
- Local fallback publisher: `npm run publish:image:home`
- Builder workflow: `.github/workflows/publish-home-image.yml`

## Public Routes (CCO HOME)

| Route | Purpose | Notes |
| --- | --- | --- |
| `/` | Content Co-op homepage | Public landing page |
| `/brief` | Creative brief intake | Public, writes through app API |
| `/cocreate` | Co-creation marketing surface | Public |
| `/onboard` | Client onboarding surface | Public |
| `/portfolio` | Portfolio gallery / proof | Public |
| `/portal/[id]` | Client portal surface | Public tokenized route |
| `/login` | Shared auth entry | Public auth screen |
| `/auth/callback` | Supabase auth callback | Public auth plumbing |

## Canonical Published Domains

| Surface | Public URL | Notes |
| --- | --- | --- |
| Home | `https://contentco-op.com` | Canonical public marketing site |
| Portfolio | `https://contentco-op.com/portfolio` | Public screening-room route on the home host |
| Creative Brief | `https://contentco-op.com/brief` | Primary public intake route |
| Public Login | `https://contentco-op.com/login` | Must render the public login screen without redirecting to `/root` |
| Co-Cut | `https://co-cut.contentco-op.com` | Dedicated product host |
| Co-Script | `https://co-script.contentco-op.com` | Dedicated product host, currently lands on `/login` |
| Co-Deliver | `https://co-deliver.contentco-op.com` | Dedicated product host, currently lands on `/login` |

## Protected Routes (ROOT)

| Route | Purpose | Notes |
| --- | --- | --- |
| `/root` | ROOT login and operator entry | Public entry, redirects authorized users to `/root/overview` |
| `/root/overview` | Overview dashboard | Protected |
| `/root/contacts` | Contact intelligence | Protected |
| `/root/dispatch` | Dispatch / operations | Protected |
| `/root/finance` | Finance control | Protected |
| `/root/quotes` | Quote management | Protected |
| `/root/quotes/new` | New quote creation | Protected |
| `/root/quotes/[id]` | Quote detail | Protected |
| `/root/system` | System health / readiness | Protected |
| `/root/work-claims` | Work-claims surface | Protected |

## Transitional Redirects

These still exist in `apps/home/next.config.ts` and should be treated as
compatibility aliases, not the canonical operator URL scheme.

| Legacy route | Redirect target |
| --- | --- |
| `/dashboard` | `/root/overview` |
| `/dashboard/contacts` | `/root/contacts` |
| `/dashboard/finance` | `/root/finance` |
| `/dashboard/operations` | `/root/dispatch` |
| `/dashboard/quotes` | `/root/quotes` |
| `/dashboard/quotes/new` | `/root/quotes/new` |
| `/dashboard/quotes/:id` | `/root/quotes/:id` |

## App API Routes

| Route | Purpose |
| --- | --- |
| `/api/auth/login` | Auth bootstrap |
| `/api/briefs` | Brief intake / list |
| `/api/briefs/[id]` | Brief detail |
| `/api/dashboard` | Shared dashboard summary |
| `/api/health` | Shared artifact health endpoint |
| `/api/onboard/chat` | Onboarding chat API |
| `/api/operations/crew` | Crew data |
| `/api/operations/dispatch` | Dispatch data |
| `/api/operations/notifications` | Notification feed |
| `/api/quotes` | Quote list/create |
| `/api/quotes/[id]` | Quote detail |
| `/api/root/contacts` | ROOT contacts data |
| `/api/root/finance` | ROOT finance data |
| `/api/root/handoffs` | ROOT handoffs |
| `/api/root/overview` | ROOT overview data |
| `/api/root/system` | ROOT system data |
| `/api/root/work-claims` | ROOT work-claims data |

## Merged ROOT Decision

- `apps/home` is the canonical live web runtime for both `CCO HOME` and `ROOT`.
- `ROOT` is one system with one live web runtime. Do not model `root/` as a
  second live app.
- `root/` remains the contract authority repo for governance, modules, tests,
  and control-plane contracts.
- Route truth for the live merged HOME/ROOT web artifact lives here and should
  stay synchronized with
  `/Users/baileyeubanks/Desktop/Projects/root/DEPLOY_CONTRACT.md`.
