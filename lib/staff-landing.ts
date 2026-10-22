/** Where Hub admins and reporting staff land after signing in. */
export const STAFF_HOME = "/hub";

/**
 * True for Hub admins and reporting admins. Reporting "defenders" are not
 * included: ordinary members sign up with that user_type, so it says nothing
 * about being staff.
 */
export function isStaffProfile(
  profile: { user_type?: string | null; is_hub_admin?: boolean | null } | null | undefined,
): boolean {
  if (!profile) return false;
  return !!profile.is_hub_admin || profile.user_type === "admin";
}
