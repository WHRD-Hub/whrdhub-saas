"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Heart, Activity, Shield, Eye, Loader2, Trash2, FileText, BookOpen, ExternalLink, ShieldCheck,
  ArrowUpRight, Pencil, Building2, KeyRound,
} from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { CONTENT_STATUS_META } from "@/lib/data";
import { Pill } from "@/components/ui/pill";
import { updateProfile } from "@/app/actions/profile";
import { deleteOwnContent } from "@/app/actions/lifecycle";
import { FemtorshipForm } from "@/components/femtorship/femtorship-form";
import { AccessibilityControls } from "@/components/accessibility-controls";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";

interface County { id: string; name: string; is_active: boolean }
interface Content { id: string; title?: string; body?: string; slug?: string | null; status: string; created_at?: string }
type Fem = Record<string, unknown> | null;
type Prof = { full_name: string; title: string; bio: string; email: string; county_network_id: string; username?: string };

type SectionId = "profile" | "networks" | "femtorship" | "activity" | "security" | "accessibility" | "admin" | "privacy";

const SECTIONS: { id: SectionId; label: string; icon: typeof User; membersOnly?: boolean; adminOnly?: boolean }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "networks", label: "Networks", icon: Building2 },
  { id: "femtorship", label: "Femtorship", icon: Heart, membersOnly: true },
  { id: "activity", label: "My activity", icon: Activity, membersOnly: true },
  { id: "security", label: "Sign-in & devices", icon: KeyRound },
  { id: "accessibility", label: "Accessibility", icon: Eye },
  { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { id: "privacy", label: "Privacy & data", icon: Shield },
];

/**
 * One place for everything about you: who you are on the Hub, which networks you
 * belong to, how you sign in, and your data. What is shown follows how you
 * joined: a reporter or anonymous account has no femtorship or posting history,
 * so those sections are simply not there.
 *
 * The server-rendered parts (networks, devices, account deletion) arrive as
 * ready-made nodes, so this component stays about layout and the forms.
 */
export function ProfileClient({
  profile, femtorship, counties, posts, blogs, reactedPosts, isAdmin = false, reporterOnly = false,
  initialSection, claim, networks, devices, deleteAccount,
}: {
  profile: Prof; femtorship: Fem; counties: County[];
  posts: Content[]; blogs: Content[];
  reactedPosts: { id: string; body: string; is_hub: boolean; status: string }[];
  isAdmin?: boolean;
  reporterOnly?: boolean;
  initialSection?: string;
  claim?: React.ReactNode;
  networks: React.ReactNode;
  devices: React.ReactNode;
  deleteAccount: React.ReactNode;
}) {
  const sections = SECTIONS.filter((s) => (!s.membersOnly || !reporterOnly) && (!s.adminOnly || isAdmin));
  const [section, setSection] = useState<SectionId>(sections.find((s) => s.id === initialSection)?.id ?? "profile");

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-1.5">Your space</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Profile &amp; account</h1>
        <p className="mt-1.5 text-sm text-muted">Who you are on the Hub, how you sign in, and your data.</p>
      </header>

      {claim}

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 lg:sticky lg:top-20 lg:flex-col">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[13.5px] transition-colors",
                section === s.id ? "bg-purple-050 font-semibold text-purple-700" : "font-medium text-ink/65 hover:bg-paper hover:text-ink",
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" /> {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          {section === "profile" && <ProfileSection profile={profile} counties={counties} reporterOnly={reporterOnly} />}
          {section === "networks" && <Card title="Your networks" desc="The county networks you belong to.">{networks}</Card>}
          {section === "femtorship" && (
            <Card title="Femtorship" desc="Update your answers any time. We use them to suggest matches.">
              <FemtorshipForm fem={femtorship} />
            </Card>
          )}
          {section === "activity" && <ActivitySection posts={posts} blogs={blogs} reacted={reactedPosts} />}
          {section === "security" && (
            <>
              <Card title="How you sign in" desc={profile.email.endsWith(".local") ? "Your account has a username and no email address." : "The address and devices that can open your account."}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {profile.username && (
                    <div><dt className="eyebrow mb-1">Username</dt><dd className="font-mono text-sm font-semibold text-ink">{profile.username}</dd></div>
                  )}
                  {!profile.email.endsWith(".local") && (
                    <div><dt className="eyebrow mb-1">Email</dt><dd className="break-all text-sm font-semibold text-ink">{profile.email}</dd></div>
                  )}
                </dl>
              </Card>
              {devices}
            </>
          )}
          {section === "accessibility" && (
            <Card title="Accessibility" desc="Adjust text size, contrast, links and motion. Saved on this device and applied everywhere.">
              <div className="max-w-md"><AccessibilityControls /></div>
            </Card>
          )}
          {section === "admin" && isAdmin && (
            <Card title="Hub admin" desc="You have Hub admin access. Switch views any time. Your choice is remembered on this device, even after you sign out.">
              <div className="max-w-md space-y-4">
                <RoleSwitcher variant="card" />
                <Link href="/hub" className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600">
                  Open the admin console <ArrowUpRight className="h-4 w-4" />
                </Link>
                <p className="text-xs text-muted">In member view your dashboard looks exactly like everyone else&apos;s. When you post or write a story, it publishes straight away instead of waiting for review.</p>
              </div>
            </Card>
          )}
          {section === "privacy" && (
            <>
              <Card title="Your data" desc="You are in control of your information.">
                <div className="flex items-center justify-between rounded-xl border border-line p-4">
                  <div><p className="text-sm font-semibold text-ink">Privacy policy</p><p className="text-xs text-muted">How the Hub handles your data.</p></div>
                  <Link href="/privacy-policy" className="inline-flex items-center gap-1 text-sm font-bold text-purple">Read <ExternalLink className="h-3.5 w-3.5" /></Link>
                </div>
              </Card>
              {deleteAccount}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card-premium p-5 sm:p-7">
      <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
      {desc ? <p className="mb-5 mt-1 text-sm text-muted">{desc}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

function ProfileSection({ profile, counties, reporterOnly }: { profile: Prof; counties: County[]; reporterOnly: boolean }) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [title, setTitle] = useState(profile.title);
  const [bio, setBio] = useState(profile.bio);
  const [county, setCounty] = useState(profile.county_network_id);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true); setError(null);
    const res = await updateProfile({ full_name: fullName.trim(), title, bio, county_network_id: county });
    setLoading(false);
    if (res?.error) setError(res.error); else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const hasEmail = !!profile.email && !profile.email.endsWith(".local");

  return (
    <Card title="Profile" desc={reporterOnly ? "Everything here is optional. Reporting never needs your name." : "This is how you appear across the Hub."}>
      <div className="max-w-lg space-y-4">
        <div><Label htmlFor="pf-name">Full name{reporterOnly && <span className="font-normal text-muted"> (optional)</span>}</Label><Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        {hasEmail && <div><Label htmlFor="pf-email">Email</Label><Input id="pf-email" value={profile.email} disabled className="opacity-70" /></div>}
        {!reporterOnly && (
          <>
            <div><Label htmlFor="pf-title">Role or profession</Label><Input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lawyer, Advocate" /></div>
            <div><Label htmlFor="pf-bio">Short bio</Label><Textarea id="pf-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A sentence about you and your work." /></div>
            <div>
              <Label htmlFor="pf-county">County network</Label>
              <select id="pf-county" value={county} onChange={(e) => setCounty(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30">
                <option value="">Not set</option>
                {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </button>
          {saved && <span className="text-sm font-semibold text-emerald-700">Saved.</span>}
        </div>
      </div>
    </Card>
  );
}

function ActivitySection({ posts, blogs, reacted }: { posts: Content[]; blogs: Content[]; reacted: { id: string; body: string; is_hub: boolean; status: string }[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"posts" | "stories" | "supported">("posts");
  const [busy, setBusy] = useState<string | null>(null);

  const del = async (kind: "post" | "blog", id: string) => {
    if (!confirm(`Delete this ${kind === "blog" ? "story" : "post"}?`)) return;
    setBusy(id);
    await deleteOwnContent(kind, id);
    setBusy(null);
    router.refresh();
  };

  const tabs = [
    { id: "posts", label: `Posts (${posts.length})` },
    { id: "stories", label: `Stories (${blogs.length})` },
    { id: "supported", label: `Supported (${reacted.length})` },
  ] as const;

  return (
    <Card title="My activity">
      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-paper p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors", tab === t.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        posts.length === 0 ? <p className="text-sm text-muted">No posts yet.</p> : (
          <div className="divide-y divide-line">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <FileText className="h-4 w-4 shrink-0 text-cyan-700" />
                <p className="flex-1 truncate text-sm text-ink">{p.body?.slice(0, 80) || "Post"}</p>
                <Pill tone={CONTENT_STATUS_META[p.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[p.status]?.label ?? p.status}</Pill>
                <button onClick={() => del("post", p.id)} disabled={busy === p.id} className="p-1 text-muted hover:text-rose-600" aria-label="Delete">
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "stories" && (
        blogs.length === 0 ? <p className="text-sm text-muted">No stories yet.</p> : (
          <div className="divide-y divide-line">
            {blogs.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-3">
                <BookOpen className="h-4 w-4 shrink-0 text-purple" />
                <p className="flex-1 truncate text-sm font-medium text-ink">{b.title}</p>
                <Pill tone={CONTENT_STATUS_META[b.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[b.status]?.label ?? b.status}</Pill>
                {(b.status === "draft" || b.status === "rejected") && (
                  <Link href={`/dashboard/write/${b.id}`} className="inline-flex items-center gap-1 px-1.5 text-xs font-bold text-purple hover:text-purple-700">
                    <Pencil className="h-3.5 w-3.5" /> {b.status === "rejected" ? "Revise" : "Edit"}
                  </Link>
                )}
                <button onClick={() => del("blog", b.id)} disabled={busy === b.id} className="p-1 text-muted hover:text-rose-600" aria-label="Delete">
                  {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "supported" && (
        reacted.length === 0 ? <p className="text-sm text-muted">You haven&apos;t supported any posts yet.</p> : (
          <div className="divide-y divide-line">
            {reacted.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <Heart className="h-4 w-4 shrink-0 fill-current text-magenta-700" />
                <p className="flex-1 truncate text-sm text-ink">{r.body?.slice(0, 80) || "Post"}</p>
                {r.is_hub && <Pill tone="purple">Hub</Pill>}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}
