import { cookies } from "next/headers";
import { PublicNav } from "@/components/public-nav";
import { SiteEditorBoot } from "@/components/site-edit/site-editor-boot";
import { getCurrentUser } from "@/lib/current-user";
import { EDIT_COOKIE } from "@/lib/site-content-store";

/** Server wrapper that resolves auth state and renders the public nav. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  // Edit mode for the public pages is for Hub super administrators only; nobody else loads it.
  const canEditSite = !!user?.profile?.is_hub_admin && !user.isDeleted && !user.isBanned;
  const editing = canEditSite && (await cookies()).get(EDIT_COOKIE)?.value === "1";
  return (
    <>
      <PublicNav signedIn={!!user} isHubAdmin={!!user?.profile?.is_hub_admin} />
      {canEditSite && <SiteEditorBoot editing={editing} />}
    </>
  );
}
