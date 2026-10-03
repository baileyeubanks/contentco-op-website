# Runbook: Failed Intake Submission

## Trigger

Use this runbook when a `/brief` submission reports "could not deliver one or
more confirmation emails", when Bailey did not receive the "New Content Co-Op
brief" alert, or when `/api/health` shows `intake_contract` as `warn`/`fail`.

## What the brief path actually does (2026-10)

1. `POST /api/cco/leads` persists the contact to CCO-DB (`briokwdoonawhxisbydy`).
2. `POST /api/cco/briefs` persists `creative_briefs`, writes one durable
   `events` row (`type = brief_submitted`, idempotent per brief), then sends
   two emails and logs each attempt in `notification_log`:
   - operator alert → `bailey@contentco-op.com` plus every address in
     `CCO_ADMIN_ALERT_EMAILS` (template `cco_public_brief_admin_alert`)
   - client receipt → the submitter (template `cco_public_brief_client_receipt`)
3. The browser then calls `POST /api/cco/briefs/proposal` for the instant
   estimate. Since 2026-10 this runs even when an email leg failed; the client
   sees "View your estimate" plus "Retry email delivery".

Relevant files:

1. `apps/home/app/api/cco/briefs/route.ts`
2. `apps/home/lib/cco-public-intake.ts` (persistence, alert roster, event, emails)
3. `apps/home/lib/email-sender.ts` (`sendTransactionalEmail`, `describeCcoEmailTransport`)
4. `apps/home/lib/repo-health.ts` (`intake_contract` check)
5. `/.env.local.example` (intake section)

## Diagnose

1. Read the health check on the live runtime:

   ```bash
   curl -s https://contentco-op.com/api/health | jq '.checks[] | select(.id=="intake_contract")'
   ```

   `meta.emailTransport` tells you which transport the host will use
   (`resend`, `gmail_oauth`, `gmail_dwd`, or `none`).

2. Read the last delivery outcomes in CCO-DB:

   ```sql
   select created_at, template_key, recipient, status,
          left(coalesce(error_message, metadata->>'delivery_error', ''), 200) as err
   from notification_log
   order by created_at desc
   limit 20;
   ```

   Known failure signature (Aug 2026): `FileNotFoundError ... /Users/_mxappservice/.config/blaze/...`
   means the runtime user on the M4 has no Gmail token file and
   `RESEND_API_KEY` is unset.

3. Confirm the brief itself persisted and the event fired:

   ```sql
   select id, created_at, company, contact_name, (data ? 'proposal') as has_proposal
   from creative_briefs order by created_at desc limit 5;
   select created_at, type, payload->>'brief_id' from events
   where type = 'brief_submitted' order by created_at desc limit 5;
   ```

## Recovery

Pick one transport and make it real on the host that runs `:4100`
(`_mxappservice@Blaze.local`):

- **Resend (preferred):** set `RESEND_API_KEY` in the runtime `.env.local`,
  with `blaze@contentco-op.com` verified as a sender in Resend.
- **Gmail OAuth:** place the token file at
  `/Users/_mxappservice/.config/blaze/google/blaze_contentcoop.json` or point
  `GOOGLE_OAUTH_TOKEN_FILE_BLAZE` at a file that user can read. Requires
  `python3` on the host (true on the M4, false in the Docker image).

Then:

1. Set `CCO_ADMIN_ALERT_EMAILS` if more than `bailey@contentco-op.com` should
   be alerted (additive; comma-separated).
2. Set `GEMINI_API_KEY` so the proposal is generated rather than mocked.
3. Publish: `npm run publish:live`.
4. Re-run the health check and submit a test brief with a `+test` address.
5. Retry failed emails for a real brief by resubmitting from the same browser
   (same submission UUID); the server resends only `failed` legs.

## Exit Criteria

`intake_contract` is `ok` with `emailTransportReady: true`, the newest
`notification_log` rows for both templates are `sent`, and the test brief has
`has_proposal = true`.
