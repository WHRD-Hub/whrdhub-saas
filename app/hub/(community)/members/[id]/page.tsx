import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Building2, FileText, BookOpen, Heart, Sprout, HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StatBar, type StatItem } from "@/components/hub/stat-bar";
import { DataTable, type Column } from "@/components/hub/data-table";
import { CONTENT_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";

const MATCH_TONE: Record<string, "green" | "amber" | "slate"> = { accepted: "green", suggested: "amber", declined: "slate" };

interface Row {
  kind: "post" | "blog";
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export default async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, title, email, avatar_url, bio, county_network_id")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: posts }, { data: blogs }, { data: county }, { data: membership }, { data: fem }, { data: matches }] = await Promise.all([
    supabase.from("posts").select("id, body, status, created_at").eq("author_id", id).order("created_at", { ascending: false }),
    supabase.from("blogs").select("id, title, status, created_at").eq("author_id", id).order("created_at", { ascending: false }),
    profile.county_network_id ? supabase.from("county_networks").select("name").eq("id", profile.county_network_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("org_memberships").select("organization_id, organizations(name)").eq("user_id", id).limit(1).maybeSingle(),
    supabase.from("mentorship_profiles").select("is_mentor, is_mentee, guidance_areas, support_offered").eq("user_id", id).maybeSingle(),
    supabase.from("mentorship_matches").select("id, mentor_id, mentee_id, status, overlap").or(`mentor_id.eq.${id},mentee_id.eq.${id}`),
  ]);

  // Resolve the other side of each match.
  const matchRows = (matches ?? []) as { id: string; mentor_id: string; mentee_id: string; status: string; overlap: string[] | null }[];
  const otherIds = Array.from(new Set(matchRows.map((m) => (m.mentor_id === id ? m.mentee_id : m.mentor_id))));
  const otherNames = new Map<string, string>();
  if (otherIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", otherIds);
    for (const p of data ?? []) otherNames.set(p.id as string, (p.full_name as string) || (p.username as string) || "WHRD member");
  }
  const mentoring = matchRows.filter((m) => m.mentor_id === id).map((m) => ({ ...m, other: otherNames.get(m.mentee_id) ?? "WHRD member" }));
  const mentoredBy = matchRows.filter((m) => m.mentee_id === id).map((m) => ({ ...m, other: otherNames.get(m.mentor_id) ?? "WHRD member" }));
  const hasFem = !!fem || mentoring.length > 0 || mentoredBy.length > 0;

  const name = (profile.full_name as string) || (profile.username as string) || "WHRD member";
  const org = membership ? (Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations) as { name: string } | null : null;
  const orgId = membership?.organization_id as string | undefined;

  const rows: Row[] = [
    ...(posts ?? []).map((p) => ({ kind: "post" as const, id: p.id as string, title: (p.body as string)?.slice(0, 80) || "Untitled post", status: p.status as string, created_at: p.created_at as string })),
    ...(blogs ?? []).map((b) => ({ kind: "blog" as const, id: b.id as string, title: (b.title as string) || "Untitled story", status: b.status as string, created_at: b.created_at as string })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const liveCount = rows.filter((r) => r.status === "approved").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const stats: StatItem[] = [
    { label: "Posts", value: posts?.length ?? 0, icon: FileText, caption: "submitted", tint: "bg-cyan-050 text-cyan-700" },
    { label: "Stories", value: blogs?.length ?? 0, icon: BookOpen, caption: "submitted", tint: "bg-purple-050 text-purple" },
    { label: "Published", value: liveCount, icon: BookOpen, caption: "live on the feed", captionTone: "up", tint: "bg-emerald-50 text-emerald-700" },
    { label: "Awaiting", value: pendingCount, icon: FileText, caption: pendingCount > 0 ? "to review" : "all clear", captionTone: pendingCount > 0 ? "down" : "up", tint: "bg-amber-50 text-amber-700" },
  ];

  const columns: Column<Row>[] = [
    {
      key: "type", header: "Type", width: "120px",
      cell: (r) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${r.kind === "blog" ? "text-purple" : "text-cyan-700"}`}>
          {r.kind === "blog" ? <BookOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {r.kind === "blog" ? "Story" : "Post"}
        </span>
      ),
    },
    { key: "title", header: "Content", width: "1.7fr", cell: (r) => <span className="text-sm text-ink truncate font-medium">{r.title}</span> },
    { key: "status", header: "Status", width: "160px", cell: (r) => <Pill tone={CONTENT_STATUS_META[r.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[r.status]?.label ?? r.status}</Pill> },
    { key: "date", header: "Date", width: "110px", cell: (r) => <span className="text-xs text-muted">{timeAgo(r.created_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <Link href={orgId ? `/hub/organizations/${orgId}` : "/hub/members"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> {org?.name ?? "Members"}
      </Link>

      {/* Member header */}
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="flex items-start gap-4">
          <Avatar name={name} src={profile.avatar_url as string} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-ink">{name}</h1>
            <p className="text-sm text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {profile.title && <span>{profile.title as string}</span>}
              {profile.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {profile.email as string}</span>}
              {county?.name && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {county.name as string}</span>}
              {org?.name && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {org.name}</span>}
            </p>
            {profile.bio && <p className="text-sm text-ink/80 mt-2 max-w-2xl">{profile.bio as string}</p>}
          </div>
        </div>
      </div>

      <StatBar items={stats} />

      {/* Femtorship — role, focus areas, and who they are matched with */}
      <div className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-1"><Heart className="w-5 h-5 text-magenta-700" /> Femtorship</h2>
        {!hasFem ? (
          <p className="text-sm text-muted mt-1">This member has not filled in their femtorship profile or been matched yet.</p>
        ) : (
          <div className="mt-3 space-y-5">
            <div className="flex flex-wrap gap-2">
              {fem?.is_mentor && <Pill tone="purple"><HandHeart className="w-3 h-3" /> Offers femtorship</Pill>}
              {fem?.is_mentee && <Pill tone="cyan"><Sprout className="w-3 h-3" /> Seeking a femtor</Pill>}
              {!fem?.is_mentor && !fem?.is_mentee && <span className="text-sm text-muted">No role set.</span>}
            </div>

            {((fem?.guidance_areas?.length ?? 0) > 0 || (fem?.support_offered?.length ?? 0) > 0) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {(fem?.guidance_areas?.length ?? 0) > 0 && (
                  <div><p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Needs guidance in</p>
                    <div className="flex flex-wrap gap-1.5">{fem!.guidance_areas!.map((a: string) => <span key={a} className="text-xs rounded-lg bg-cyan-050 text-cyan-700 px-2 py-1 font-medium">{a}</span>)}</div>
                  </div>
                )}
                {(fem?.support_offered?.length ?? 0) > 0 && (
                  <div><p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Can support with</p>
                    <div className="flex flex-wrap gap-1.5">{fem!.support_offered!.map((a: string) => <span key={a} className="text-xs rounded-lg bg-purple-050 text-purple-700 px-2 py-1 font-medium">{a}</span>)}</div>
                  </div>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Mentoring ({mentoring.length})</p>
                {mentoring.length === 0 ? <p className="text-sm text-muted">Not mentoring anyone yet.</p> : (
                  <ul className="space-y-1.5">{mentoring.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Avatar name={m.other} size={24} /><span className="text-ink font-medium truncate">{m.other}</span>
                      <Pill tone={MATCH_TONE[m.status] ?? "slate"}>{m.status}</Pill>
                    </li>
                  ))}</ul>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Mentored by ({mentoredBy.length})</p>
                {mentoredBy.length === 0 ? <p className="text-sm text-muted">No femtor matched yet.</p> : (
                  <ul className="space-y-1.5">{mentoredBy.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Avatar name={m.other} size={24} /><span className="text-ink font-medium truncate">{m.other}</span>
                      <Pill tone={MATCH_TONE[m.status] ?? "slate"}>{m.status}</Pill>
                    </li>
                  ))}</ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content table — click a row to review, edit, and publish */}
      <div>
        <h2 className="text-lg font-black text-ink mb-1">Content</h2>
        <p className="text-sm text-muted mb-3">Everything this member has submitted. Open any item to review, edit, and publish or decline it.</p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.kind}-${r.id}`}
          rowHref={(r) => (r.kind === "post" ? `/hub/posts/${r.id}` : `/hub/blogs/${r.id}`)}
          emptyIcon={FileText}
          emptyTitle="Nothing posted yet"
          emptySubtitle="When this member shares a post or story, it will appear here for review."
        />
      </div>
    </div>
  );
}
