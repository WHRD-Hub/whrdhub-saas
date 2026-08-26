import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Users, Mail, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { DataTable, type Column } from "@/components/hub/data-table";
import { OrgVerifyControls } from "@/components/hub/org-verify-controls";
import { VERIF_STATUS_META } from "@/lib/data";
import { timeAgo } from "@/lib/utils";

interface Member {
  id: string; name: string; email: string; title: string | null; avatar: string | null; role: string; joined: string;
}

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, description, verification_status, created_at, county_networks(name)")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("user_id, role, created_at")
    .eq("organization_id", id);

  const ids = (memberships ?? []).map((m) => m.user_id as string);
  const profs = new Map<string, { full_name: string; email: string; title: string | null; avatar_url: string | null }>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, email, title, avatar_url").in("id", ids);
    for (const p of data ?? []) profs.set(p.id as string, { full_name: (p.full_name as string) || "WHRD member", email: (p.email as string) ?? "", title: (p.title as string) ?? null, avatar_url: (p.avatar_url as string) ?? null });
  }

  const county = Array.isArray(org.county_networks) ? org.county_networks[0]?.name : (org.county_networks as { name: string } | null)?.name;
  const isVerified = org.verification_status === "verified";

  const members: Member[] = (memberships ?? []).map((m) => {
    const p = profs.get(m.user_id as string);
    return {
      id: m.user_id as string,
      name: p?.full_name ?? "WHRD member",
      email: p?.email ?? "",
      title: p?.title ?? null,
      avatar: p?.avatar_url ?? null,
      role: m.role as string,
      joined: timeAgo(m.created_at as string),
    };
  });

  const columns: Column<Member>[] = [
    {
      key: "member", header: "Member", width: "1.5fr",
      cell: (m) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={m.name} src={m.avatar} size={34} />
          <div className="min-w-0"><p className="text-sm font-bold text-ink truncate">{m.name}</p>{m.title && <p className="text-xs text-muted truncate">{m.title}</p>}</div>
        </div>
      ),
    },
    { key: "contact", header: "Contact", width: "1.4fr", cell: (m) => <span className="text-xs text-muted truncate flex items-center gap-1.5">{m.email && <><Mail className="w-3 h-3 shrink-0" /> {m.email}</>}</span> },
    { key: "role", header: "Role", width: "130px", cell: (m) => <Pill tone={m.role === "org_admin" ? "purple" : "slate"}>{m.role === "org_admin" ? "Org admin" : "Member"}</Pill> },
    { key: "joined", header: "Joined", width: "110px", cell: (m) => <span className="text-xs text-muted">{m.joined}</span> },
  ];

  return (
    <div className="space-y-6">
      <Link href="/hub/organizations" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" /> CBOs</Link>

      {/* Unverified action banner at the top */}
      {!isVerified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">This CBO is not verified yet</p>
                <p className="text-sm text-amber-800">Verify it so its members and content can go public.</p>
              </div>
            </div>
            <OrgVerifyControls id={org.id as string} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-050 text-purple grid place-items-center shrink-0"><Building2 className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-black text-ink">{org.name}</h1>
              <p className="text-sm text-muted mt-0.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {county ?? "No county"} · added {timeAgo(org.created_at as string)} · {members.length} member(s)</p>
              {org.description && <p className="text-sm text-ink/80 mt-2 max-w-2xl">{org.description}</p>}
            </div>
          </div>
          <Pill tone={VERIF_STATUS_META[org.verification_status as string]?.tone ?? "slate"}>{VERIF_STATUS_META[org.verification_status as string]?.label ?? org.verification_status}</Pill>
        </div>
      </div>

      {/* Members table */}
      <div>
        <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-purple" /> Members ({members.length})</h2>
        <DataTable
          columns={columns}
          rows={members}
          rowKey={(m) => m.id}
          rowHref={(m) => `/hub/members/${m.id}`}
          emptyIcon={Users}
          emptyTitle="No members yet"
          emptySubtitle="Defenders who join this CBO will appear here."
        />
      </div>
    </div>
  );
}
