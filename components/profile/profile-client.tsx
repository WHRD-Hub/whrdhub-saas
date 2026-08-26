"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Heart, Activity, Shield, Eye, Loader2, Trash2, FileText, BookOpen, ExternalLink, ShieldCheck, ArrowUpRight, Pencil } from "lucide-react";
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
type Prof = { full_name: string; title: string; bio: string; email: string; county_network_id: string };

const SECTIONS = [
  { id: "account", label: "Account Information", icon: User },
  { id: "femtorship", label: "Femtorship", icon: Heart },
  { id: "activity", label: "My Activity", icon: Activity },
  { id: "accessibility", label: "Accessibility", icon: Eye },
  { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { id: "privacy", label: "Privacy & Security", icon: Shield },
] as const;

export function ProfileClient({
  profile, femtorship, counties, posts, blogs, reactedPosts, isAdmin = false,
}: {
  profile: Prof; femtorship: Fem; counties: County[];
  posts: Content[]; blogs: Content[];
  reactedPosts: { id: string; body: string; is_hub: boolean; status: string }[];
  isAdmin?: boolean;
}) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("account");
  const sections = SECTIONS.filter((s) => !("adminOnly" in s && s.adminOnly) || isAdmin);

  return (
    <div>
      <h1 className="text-2xl font-black text-ink mb-6">Profile &amp; Settings</h1>
      <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Side nav (Sauti-style) */}
        <div className="rounded-2xl border border-line bg-surface p-2 flex lg:flex-col gap-1 overflow-x-auto lg:sticky lg:top-20">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={cn("flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors", section === s.id ? "bg-purple-050 text-purple-700" : "text-ink/70 hover:bg-purple-050")}>
              <s.icon className="w-4 h-4 shrink-0" /> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0">
          {section === "account" && <AccountSection profile={profile} counties={counties} />}
          {section === "femtorship" && (
            <Card title="Femtorship" desc="Update your answers any time. We use them to suggest matches.">
              <FemtorshipForm fem={femtorship} />
            </Card>
          )}
          {section === "activity" && <ActivitySection posts={posts} blogs={blogs} reacted={reactedPosts} />}
          {section === "accessibility" && (
            <Card title="Accessibility" desc="Adjust text size, contrast, links, and motion. Your choices are saved on this device and apply everywhere.">
              <div className="max-w-md"><AccessibilityControls /></div>
            </Card>
          )}
          {section === "admin" && isAdmin && (
            <Card title="Hub admin" desc="You have Hub admin access. Switch views any time. Your choice is remembered on this device, even after you sign out.">
              <div className="max-w-md space-y-4">
                <RoleSwitcher variant="card" />
                <Link href="/hub" className="inline-flex items-center gap-2 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600">
                  Open the admin console <ArrowUpRight className="w-4 h-4" />
                </Link>
                <p className="text-xs text-muted">In member view your dashboard looks exactly like everyone else&apos;s. When you post or write a story, it publishes straight away instead of waiting for review.</p>
              </div>
            </Card>
          )}
          {section === "privacy" && <PrivacySection />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 mb-5">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      {desc && <p className="text-sm text-muted mt-0.5 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </section>
  );
}

function AccountSection({ profile, counties }: { profile: Prof; counties: County[] }) {
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

  return (
    <Card title="Account information" desc="This is how you appear across the Hub.">
      <div className="space-y-4 max-w-lg">
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><Label>Email</Label><Input value={profile.email} disabled className="opacity-70" /></div>
        <div><Label>Role or profession</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lawyer, Advocate" /></div>
        <div><Label>Short bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A sentence about you and your work." /></div>
        <div>
          <Label>County network</Label>
          <select value={county} onChange={(e) => setCounty(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30">
            <option value="">Not set</option>
            {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </button>
          {saved && <span className="text-sm text-emerald-700 font-semibold">Saved.</span>}
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
      <div className="flex gap-1 mb-4 rounded-xl border border-line bg-paper p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-lg px-4 py-2 text-sm font-bold transition-colors", tab === t.id ? "bg-purple text-white" : "text-ink/70 hover:bg-purple-050")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        posts.length === 0 ? <p className="text-sm text-muted">No posts yet.</p> : (
          <div className="divide-y divide-line">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
                <p className="text-sm text-ink truncate flex-1">{p.body?.slice(0, 80) || "Post"}</p>
                <Pill tone={CONTENT_STATUS_META[p.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[p.status]?.label ?? p.status}</Pill>
                <button onClick={() => del("post", p.id)} disabled={busy === p.id} className="text-muted hover:text-rose-600 p-1" aria-label="Delete">
                  {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
                <BookOpen className="w-4 h-4 text-purple shrink-0" />
                <p className="text-sm text-ink truncate flex-1 font-medium">{b.title}</p>
                <Pill tone={CONTENT_STATUS_META[b.status]?.tone ?? "slate"}>{CONTENT_STATUS_META[b.status]?.label ?? b.status}</Pill>
                {(b.status === "draft" || b.status === "rejected") && (
                  <Link href={`/dashboard/write/${b.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-purple hover:text-purple-700 px-1.5">
                    <Pencil className="w-3.5 h-3.5" /> {b.status === "rejected" ? "Revise" : "Edit"}
                  </Link>
                )}
                <button onClick={() => del("blog", b.id)} disabled={busy === b.id} className="text-muted hover:text-rose-600 p-1" aria-label="Delete">
                  {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
                <Heart className="w-4 h-4 text-magenta-700 fill-current shrink-0" />
                <p className="text-sm text-ink truncate flex-1">{r.body?.slice(0, 80) || "Post"}</p>
                {r.is_hub && <Pill tone="purple">Hub</Pill>}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}

function PrivacySection() {
  return (
    <>
      <Card title="Your data" desc="You are in control of your information.">
        <div className="flex items-center justify-between rounded-xl border border-line p-4">
          <div><p className="font-semibold text-ink text-sm">Privacy policy</p><p className="text-xs text-muted">How the Hub handles your data.</p></div>
          <Link href="/about" className="inline-flex items-center gap-1 text-sm font-bold text-purple">Read <ExternalLink className="w-3.5 h-3.5" /></Link>
        </div>
      </Card>

      <Card
        title="Delete account"
        desc="Close your Hub account. Your profile and everything you have posted leaves the site."
      >
        <Link
          href="/dashboard/account"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-300 px-5 text-sm font-bold text-rose-700 hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" /> Go to account settings
        </Link>
      </Card>
    </>
  );
}
