# CCO Firebase Contract

This folder is the code-side Firebase contract for the pristine CCO project. Do not deploy it into a shared ROOT or ACS project.

Expected project setup:

- Firebase Auth with custom claim `ccoRole` set to `owner`, `admin`, or `operator`.
- Owner/admin seed accounts: `bailey@contentco-op.com`, `blaze@contentco-op.com`.
- Firestore collections: `people`, `organizations`, `relationships`, `briefs`, `estimates`, `proposalVersions`, `approvals`, `bookings`, `projects`, `appHandoffs`, `enrichmentRuns`, `emailOutbox`, `auditEvents`, `files`.
- Trigger Email extension watches `emailOutbox`.
- Google Calendar service account is shared into the CCO discovery calendar before `CCO_DISCOVERY_CALENDAR_ID` is enabled.

The app only commits Firestore writes when `CCO_FIREBASE_PROJECT_ID` or `FIREBASE_PROJECT_ID` is present with Firebase Admin credentials. Without that, routes return the write contract and do not mutate Firebase.

Local CLI setup:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0922810579
```

Do not run deploys until the active Firebase account and target project are confirmed in the console.
