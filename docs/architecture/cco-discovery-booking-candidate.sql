-- UNAPPLIED CCO-DB candidate. Review/test before generating migration history.
-- No live grants, policies, credentials or schema are changed by this file.
-- Direct bookings deliberately have no required creative_brief relationship.
create table public.cco_discovery_bookings (
  id uuid primary key default gen_random_uuid(),
  contract text not null default 'cco.discovery-booking.v1' check (contract = 'cco.discovery-booking.v1'),
  company_account_id text not null default 'content-co-op' check (company_account_id = 'content-co-op'),
  submission_id uuid not null unique,
  fingerprint text not null,
  calendar_id text not null,
  organizer_email text not null,
  name text not null,
  email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at = starts_at + interval '20 minutes'),
  state text not null default 'pending' check (state in ('pending','confirmed','needs_reconcile')),
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'confirmed') = (receipt is not null))
);
alter table public.cco_discovery_bookings enable row level security;
-- No public policies: service-side existing CCO-DB binding only. No SECURITY DEFINER.
create function public.cco_claim_discovery_booking(p_input jsonb, p_calendar_id text, p_organizer_email text, p_fingerprint text, p_offered boolean)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare r public.cco_discovery_bookings; s timestamptz; e timestamptz;
begin
  -- Serializes replay identity and overlapping claims for the same calendar.
  perform pg_advisory_xact_lock(hashtextextended('cco-discovery-submission:' || (p_input->>'submissionId'), 0));
  perform pg_advisory_xact_lock(hashtextextended('cco-discovery-calendar:' || p_calendar_id, 0));
  select * into r from public.cco_discovery_bookings where submission_id = (p_input->>'submissionId')::uuid;
  if found then
    if r.fingerprint <> p_fingerprint then raise exception 'booking_submission_conflict'; end if;
    return jsonb_build_object('record', to_jsonb(r), 'fresh', false);
  end if;
  if p_offered is distinct from true then raise exception 'slot_not_offered'; end if;
  s := (p_input->>'startsAt')::timestamptz; e := (p_input->>'endsAt')::timestamptz;
  if s <= now() or s > now() + interval '30 days' or e <> s + interval '20 minutes' then raise exception 'invalid_booking_time'; end if;
  if exists (select 1 from public.cco_discovery_bookings where calendar_id = p_calendar_id and starts_at < e and ends_at > s) then raise exception 'slot_already_claimed'; end if;
  insert into public.cco_discovery_bookings (submission_id, fingerprint, calendar_id, organizer_email, name, email, starts_at, ends_at)
  values ((p_input->>'submissionId')::uuid,p_fingerprint,p_calendar_id,p_organizer_email,p_input->>'name',p_input->>'email',s,e) returning * into r;
  return jsonb_build_object('record', to_jsonb(r), 'fresh', true);
end $$;
create function public.cco_settle_discovery_booking(p_id uuid, p_fingerprint text, p_receipt jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare r public.cco_discovery_bookings;
begin
  select * into strict r from public.cco_discovery_bookings where id = p_id and fingerprint = p_fingerprint for update;
  -- A concurrent unsuccessful replay cannot downgrade a confirmed receipt.
  if r.state = 'confirmed' then return to_jsonb(r); end if;
  if p_receipt is not null and (
    p_receipt->>'eventId' is distinct from 'cco' || replace(r.id::text,'-','') or
    p_receipt->>'bookingId' is distinct from r.id::text or
    (p_receipt->>'startsAt')::timestamptz is distinct from r.starts_at or
    (p_receipt->>'endsAt')::timestamptz is distinct from r.ends_at or
    p_receipt->>'organizerEmail' is distinct from r.organizer_email or
    coalesce(p_receipt->>'meetUrl','') !~ '^https://meet[.]google[.]com/[a-z-]+$' or
    coalesce(p_receipt->>'htmlLink','') !~ '^https://(www[.])?google[.]com/calendar/' or
    jsonb_typeof(p_receipt->'attendees') is distinct from 'array' or
    not (p_receipt->'attendees' @> jsonb_build_array(r.email,r.organizer_email)) or
    jsonb_array_length(p_receipt->'attendees') <> (case when r.email = r.organizer_email then 1 else 2 end)
  ) then raise exception 'invalid_calendar_receipt'; end if;
  update public.cco_discovery_bookings set state = case when p_receipt is null then 'needs_reconcile' else 'confirmed' end,
    receipt = p_receipt, updated_at = now() where id = p_id returning * into r;
  return to_jsonb(r);
end $$;
