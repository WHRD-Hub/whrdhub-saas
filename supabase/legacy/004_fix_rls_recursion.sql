-- Fix: infinite recursion in the org_memberships SELECT policy.
-- Run this whole file in the Supabase SQL editor. Safe to run more than once.
--
-- The previous policy read org_memberships from inside a policy ON
-- org_memberships, which recurses. We move that lookup into a SECURITY DEFINER
-- function that bypasses RLS, so there is no recursion.

create or replace function public.my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.org_memberships where user_id = auth.uid();
$$;

drop policy if exists mem_read on public.org_memberships;

create policy mem_read on public.org_memberships
for select
using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_org_ids())
);
