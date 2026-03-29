# Runbook: Failed Intake Submission

## Trigger

Use this runbook when the creative brief route fails, `/api/health` reports intake issues, or the intake readiness audit turns critical.

## Diagnose

```bash
npm run ops:intake
curl -i http://127.0.0.1:4100/api/health?scope=local
```

Relevant files:

1. [`apps/home/app/api/briefs/route.ts`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/app/api/briefs/route.ts)
2. [`apps/home/lib/creative-brief.ts`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/creative-brief.ts)
3. [`/.env.local.example`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/.env.local.example)

## Recovery

1. Restore missing env vars required by the brief route.
2. Confirm the route still normalizes payloads, writes `creative_briefs`, and emits `events`.
3. Confirm `CREATIVE_BRIEF_HANDOFF_VERSION` remains namespaced and current.
4. Re-run `npm run ops:intake`.
5. Re-run `npm run ops:audit`.

## Exit Criteria

The intake readiness report is healthy and `/api/health?scope=local` no longer reports intake failures.
