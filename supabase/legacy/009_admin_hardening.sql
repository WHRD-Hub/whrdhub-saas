-- Admin hardening.
-- Plain ASCII only (no box-art) to avoid SQL editor parse errors.
--
-- Why: is_hub_admin() previously read profiles.user_type, a column that only
-- exists on the reporting platform's profile shape. Where it is missing, the
-- function errors, which in turn breaks any RLS policy that calls it (for
-- example an admin viewing pending or rejected posts and stories). The Hub owns
-- its own profiles.is_hub_admin boolean, so we rely on that alone.

create or replace function public.is_hub_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_hub_admin from public.profiles where id = uid),
    false
  );
$$;

-- Safe to run more than once.
