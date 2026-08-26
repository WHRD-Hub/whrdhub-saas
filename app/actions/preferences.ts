"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateLanguagePreference(language: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_language: language })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
