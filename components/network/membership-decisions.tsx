"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Shield, User } from "lucide-react";
import { decideMembership, setMemberRole } from "@/app/actions/membership";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { SuspendMember } from "@/components/network/suspend-member";

export interface MemberRow {
  id: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  role: "member" | "org_admin";
  requested_at: string | null;
  request_note: string | null;
  suspensionReason: string | null;
  orgName: string;
  person: {
    name: string;
    title: string | null;
    avatar_url: string | null;
    fromReporting: boolean;
    banned: boolean;
  };
}

/**
 * Running a network's membership: approving the people who ask to join,
 * appointing other admins, and pausing a member who needs pausing.
 *
 * Requests arriving from the reporting side are flagged, because they are the
 * ones an organisation is least likely to recognise: the person may have come
 * to the platform to file a report and only later decided to join.
 */
export function MembershipDecisions({
  pending,
  members,
  suspended,
  canManageRoles,
}: {
  pending: MemberRow[];
  members: MemberRow[];
  suspended: MemberRow[];
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const decide = (row: MemberRow, decision: "approved" | "rejected") => {
    setBusy(row.id);
    start(async () => {
      const res = await decideMembership(row.id, decision);
      setBusy(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "approved" ? "Approved. They are in." : "Request declined.");
      router.refresh();
    });
  };

  const changeRole = (row: MemberRow, role: "member" | "org_admin") => {
    setBusy(row.id);
    start(async () => {
      const res = await setMemberRole(row.id, role);
      setBusy(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(role === "org_admin" ? "Promoted to network admin." : "Set to member.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-black text-ink">
          Awaiting your decision
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-magenta px-2 py-0.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Nothing waiting. New requests to join your network will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {pending.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 p-4">
                <Avatar name={row.person.name} src={row.person.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{row.person.name}</p>
                  <p className="text-xs text-muted">
                    {[row.person.title, row.orgName].filter(Boolean).join(" · ")}
                    {row.requested_at ? ` · asked ${timeAgo(row.requested_at)}` : ""}
                  </p>
                  {row.person.fromReporting && (
                    <span className="mt-1.5 inline-block">
                      <Pill tone="cyan">Came from the reporting platform</Pill>
                    </span>
                  )}
                  {row.request_note && (
                    <p className="mt-2 rounded-lg bg-paper p-2.5 text-sm text-ink/80">
                      {row.request_note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => decide(row, "approved")}
                    disabled={busy === row.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple px-3 text-xs font-bold text-white hover:bg-purple-600 disabled:opacity-50"
                  >
                    {busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => decide(row, "rejected")}
                    disabled={busy === row.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-ink/70 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suspended.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">
            Suspended
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {suspended.length}
            </span>
          </h2>
          <p className="mb-3 max-w-prose text-sm text-muted">
            These members cannot post or comment. The Hub has been told about each
            suspension and can take it further if it needs to.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-amber-200 bg-surface">
            {suspended.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 p-4">
                <Avatar name={row.person.name} src={row.person.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{row.person.name}</p>
                  <p className="text-xs text-muted">{row.orgName}</p>
                  {row.suspensionReason && (
                    <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                      {row.suspensionReason}
                    </p>
                  )}
                  {row.person.banned && (
                    <span className="mt-2 inline-block">
                      <Pill tone="red">Banned by the Hub</Pill>
                    </span>
                  )}
                </div>
                <SuspendMember membershipId={row.id} name={row.person.name} suspended />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-ink">Members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            No approved members yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {members.map((row) => (
              <li key={row.id} className="flex items-center gap-3 p-4">
                <Avatar name={row.person.name} src={row.person.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{row.person.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[row.person.title, row.orgName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {row.role === "org_admin" ? (
                  <Pill tone="purple">
                    <Shield className="h-3 w-3" /> Admin
                  </Pill>
                ) : null}
                {canManageRoles && (
                  <button
                    onClick={() => changeRole(row, row.role === "org_admin" ? "member" : "org_admin")}
                    disabled={busy === row.id}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink/70 hover:bg-purple-050 disabled:opacity-50"
                  >
                    {row.role === "org_admin" ? <User className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {row.role === "org_admin" ? "Make member" : "Make admin"}
                  </button>
                )}
                <SuspendMember
                  membershipId={row.id}
                  name={row.person.name}
                  suspended={false}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
