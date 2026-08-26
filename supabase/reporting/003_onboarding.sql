-- Migration 003: Onboarding fields
-- Tracks whether a staff member has completed the role-selection + T&C onboarding flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at    timestamptz;

-- Existing admin/defender users who were manually set up before this migration
-- are considered already onboarded so they aren't redirected to /onboarding.
UPDATE public.profiles
  SET onboarding_completed = true
  WHERE user_type IN ('admin', 'defender')
    AND onboarding_completed IS DISTINCT FROM true;

-- NOTE: anonymous reporters are intentionally NOT pre-marked as complete.
-- They must accept the Terms & Conditions before accessing their dashboard.
