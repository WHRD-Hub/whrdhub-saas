import { redirect } from "next/navigation";

/**
 * The account page and the profile page were two screens for one thing. They are
 * one now, at /profile; this stays so old links, emails and bookmarks still work.
 */
export default function AccountPage() {
  redirect("/profile");
}
