-- Fix: infinite recursion in profiles RLS policies.
-- The admin policies were doing SELECT FROM profiles inside a policy ON profiles.
-- Solution: SECURITY DEFINER helper function that bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_my_user_type()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT user_type::text FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "admins_read_all_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "admins_update_all_profiles"  ON public.profiles;

CREATE POLICY "admins_read_all_profiles" ON public.profiles
  FOR SELECT USING (
    public.get_my_user_type() IN ('defender', 'admin')
  );

CREATE POLICY "admins_update_all_profiles" ON public.profiles
  FOR UPDATE USING (
    public.get_my_user_type() = 'admin'
  );
