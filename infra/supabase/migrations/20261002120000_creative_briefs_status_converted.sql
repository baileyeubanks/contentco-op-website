-- Allow brief → project conversion to mark the brief as converted.
-- `createProjectFromBrief` (apps/home/lib/os-projects-engine.ts) writes
-- status = 'converted', which the original onboarding_v1 check constraint
-- rejected, so the project was created but the brief stayed 'submitted'.
--
-- CCO-DB only (briokwdoonawhxisbydy). Apply with explicit owner approval.

alter table public.creative_briefs
  drop constraint if exists creative_briefs_status_check;

alter table public.creative_briefs
  add constraint creative_briefs_status_check
  check (status = any (array[
    'submitted'::text,
    'reviewed'::text,
    'in_progress'::text,
    'converted'::text,
    'delivered'::text,
    'closed'::text
  ]));
