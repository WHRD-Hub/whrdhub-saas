import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KENYA_COUNTIES } from "@/lib/reporting-options";

export interface CountyNetwork { id: string; name: string; is_active: boolean }

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Every one of Kenya's 47 counties, as the county-network list people pick from.
 *
 * Only eight networks are live, and the table historically held only those, so
 * the dropdown offered eight. Any county missing from the table is added here
 * (as not live), which also makes the full list appear without anyone having to
 * run the seed first. Live networks sort first.
 */
export async function loadCountyNetworks(): Promise<CountyNetwork[]> {
  const supabase = await createClient();
  const read = () =>
    supabase.from("county_networks").select("id, name, is_active").order("is_active", { ascending: false }).order("name");

  const { data } = await read();
  const have = new Set((data ?? []).map((c) => (c.name as string).toLowerCase()));
  const missing = KENYA_COUNTIES.filter((c) => !have.has(c.toLowerCase()));
  if (missing.length === 0) return (data ?? []) as CountyNetwork[];

  try {
    await createAdminClient()
      .from("county_networks")
      .upsert(missing.map((name) => ({ name, slug: slugOf(name), is_active: false })), { onConflict: "slug", ignoreDuplicates: true });
    const { data: after } = await read();
    return (after ?? []) as CountyNetwork[];
  } catch {
    return (data ?? []) as CountyNetwork[];
  }
}
