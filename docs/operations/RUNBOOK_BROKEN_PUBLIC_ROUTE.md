# Runbook: Broken Public Route

## Trigger

Use this runbook when `/`, `/portfolio`, `/book`, `/brief`, or `/login` fails the smoke check.

## Diagnose

```bash
npm run ops:routes
curl -i http://127.0.0.1:4100/api/health?scope=local
```

If the app is not already running locally:

```bash
npm run build -w @contentco-op/home
npm run start -w @contentco-op/home
```

## Recovery

1. Restore the route file in `apps/home/app`.
2. Confirm the route still renders the expected marker text.
3. Re-run `npm run ops:routes`.
4. Re-run `npm run ops:audit`.

## Exit Criteria

The route report is healthy and the failing path no longer appears in the latest audit artifact.
