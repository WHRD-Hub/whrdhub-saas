import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email/send";
import { buildSafetyPlan } from "@/lib/abuse-profiles";
import { incidentLabel } from "@/lib/reporting-options";
import { decideYesNo, jevMayReadReports } from "@/lib/decide";

/**
 * Urgent-case alerts.
 *
 * A report that describes someone in danger should not wait for an admin to
 * open the console. When one is filed (or becomes critical after an update) the
 * response team is told straight away by an in-app notification, a push to
 * every device they enabled it on, and an email. If nobody acknowledges it, it
 * is raised again, to a wider circle, after a set time (see escalateOverdue).
 *
 * Alerts never carry what the reporter wrote, their contact details or their
 * location. They say that a case needs attention, what kind, and where to open
 * it. Anyone intercepting a lock screen or an inbox learns nothing about her.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

const FIRST_AFTER_MIN = Number(process.env.ESCALATE_AFTER_MIN) || 15;
const FINAL_AFTER_MIN = Number(process.env.ESCALATE_FINAL_AFTER_MIN) || 60;

let pushReady: boolean | null = null;
function configurePush(): boolean {
  if (pushReady !== null) return pushReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (pushReady = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:tech@whrdhub.org", pub, priv);
  return (pushReady = true);
}

interface ReportRow {
  id: string;
  incident_types: string[] | null;
  risks: string[] | null;
  urgency: string | null;
  county: string | null;
  description?: string | null;
  alert_severity: string | null;
  escalation_level: number | null;
}

async function staff(): Promise<{ id: string; email: string | null }[]> {
  const { data } = await db().from("profiles").select("id, email").or("is_hub_admin.eq.true,user_type.eq.admin");
  return (data ?? []) as { id: string; email: string | null }[];
}

const publicBase = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function describe(r: ReportRow): { title: string; body: string; path: string } {
  const kinds = (r.incident_types ?? []).map(incidentLabel).slice(0, 2).join(", ") || "Report";
  return {
    title: "Urgent report needs a response",
    body: `${kinds}${r.county ? ` · ${r.county}` : ""} · ref ${r.id.slice(0, 8).toUpperCase()}`,
    path: `/hub/reporting/reports/${r.id}`,
  };
}

async function pushTo(userIds: string[], payload: { title: string; body: string; url: string; tag: string }) {
  if (!userIds.length || !configurePush()) return 0;
  const { data: subs } = await db().from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  if (!subs?.length) return 0;
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    (subs as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 6,
          urgency: "high",
        });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await db().from("push_subscriptions").delete().in("id", dead);
  return sent;
}

/** Tell the response team. Level 1 is the admins; level 2 and 3 also reach the second-line list. */
async function notifyStaff(r: ReportRow, level: number) {
  const msg = describe(r);
  const people = await staff();
  const ids = people.map((p) => p.id);

  if (ids.length) {
    await db().from("notifications").insert(
      ids.map((user_id) => ({
        user_id,
        report_id: r.id,
        type: "urgent_report",
        title: level > 1 ? `Still unanswered: ${msg.title.toLowerCase()}` : msg.title,
        body: msg.body,
        link: msg.path,
        content_type: "report",
        content_id: r.id,
      })),
    );
  }

  await pushTo(ids, { title: level > 1 ? "Still unanswered: urgent report" : msg.title, body: msg.body, url: msg.path, tag: `urgent-${r.id}` });

  const second = (process.env.ESCALATION_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const real = people.map((p) => p.email).filter((e): e is string => !!e && !e.endsWith(".local"));
  const to = [...new Set(level > 1 || real.length === 0 ? [...real, ...second] : real)];
  const link = `${publicBase()}${msg.path}`;
  const subject = level > 1 ? `Still unanswered: ${msg.title}` : msg.title;
  await Promise.all(
    to.map((email) =>
      sendMail({
        to: email,
        subject,
        text: `${msg.body}\n\nOpen the case: ${link}\n\nNothing the reporter wrote is included in this message.`,
        html: `<p style="font:16px/1.5 system-ui,sans-serif"><strong>${msg.title}</strong></p><p style="font:15px/1.5 system-ui,sans-serif">${msg.body}</p><p><a href="${link}" style="display:inline-block;background:#734e9e;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font:600 14px system-ui,sans-serif">Open the case</a></p><p style="font:12px/1.5 system-ui,sans-serif;color:#6c6577">Nothing the reporter wrote is included in this message.</p>`,
      }).catch(() => null),
    ),
  );
}

/**
 * Work out how serious a freshly filed (or updated) report is and, if it is
 * critical, alert the team once. Safe to call repeatedly: a report that was
 * already alerted is left alone.
 */
export async function alertOnReport(reportId: string): Promise<{ severity: "critical" | "normal"; alerted: boolean }> {
  try {
    const { data } = await db()
      .from("reports")
      .select("id, incident_types, risks, urgency, county, description, alert_severity, escalation_level")
      .eq("id", reportId)
      .is("deleted_at", null)
      .maybeSingle();
    const r = data as ReportRow | null;
    if (!r) return { severity: "normal", alerted: false };
    if (r.alert_severity === "critical") return { severity: "critical", alerted: false };

    const types = r.incident_types ?? [];
    const risks = r.risks ?? [];
    let critical = r.urgency === "immediate" || buildSafetyPlan(types, risks).critical;

    // Someone may tick "no rush" and describe a life-threatening situation in the same report.
    // Only with a deliberate opt-in, because it sends the private text to Jev (see lib/decide.ts).
    if (!critical && r.description && jevMayReadReports()) {
      const verdict = await decideYesNo(
        r.description,
        "Does this report describe someone who is in immediate physical danger, or whose life is at risk right now or very soon?",
        "Yes, immediate danger",
        "No, not immediate danger",
      );
      if (verdict?.yes && verdict.probability >= 0.75) critical = true;
    }

    if (!critical) return { severity: "normal", alerted: false };

    await db().from("reports").update({ alert_severity: "critical", escalation_level: 1, escalated_at: new Date().toISOString() }).eq("id", reportId);
    await notifyStaff(r, 1);
    return { severity: "critical", alerted: true };
  } catch (err) {
    // An alert that fails must never undo the report that triggered it.
    console.error("[alerts] could not alert on report", reportId, err);
    return { severity: "normal", alerted: false };
  }
}

/**
 * Raise unacknowledged critical reports again: to everyone after the first
 * window, and once more (with the second-line list) after the final one.
 * Called by the cron route.
 */
export async function escalateOverdue(): Promise<{ checked: number; escalated: number }> {
  const { data } = await db()
    .from("reports")
    .select("id, incident_types, risks, urgency, county, alert_severity, escalation_level, escalated_at")
    .eq("alert_severity", "critical")
    .is("acknowledged_at", null)
    .is("deleted_at", null)
    .in("status", ["submitted", "under_review"])
    .lt("escalation_level", 3);

  const now = Date.now();
  let escalated = 0;
  for (const r of (data ?? []) as (ReportRow & { escalated_at: string | null })[]) {
    const level = r.escalation_level ?? 1;
    const since = (now - new Date(r.escalated_at ?? 0).getTime()) / 60_000;
    const due = level === 1 ? since >= FIRST_AFTER_MIN : level === 2 ? since >= FINAL_AFTER_MIN : false;
    if (!due) continue;
    await db().from("reports").update({ escalation_level: level + 1, escalated_at: new Date().toISOString() }).eq("id", r.id);
    await notifyStaff(r, level + 1);
    escalated++;
  }
  return { checked: (data ?? []).length, escalated };
}

/**
 * Tell the response team something that is not about one report: in-app and
 * push, no email. Skipped if the same notice was already sent in the last day.
 */
export async function broadcastToStaff(m: { type: string; title: string; body: string; path: string; tag: string }): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: dup } = await db().from("notifications").select("id").eq("type", m.type).eq("title", m.title).gt("created_at", since).limit(1);
    if (dup?.length) return false;
    const ids = (await staff()).map((p) => p.id);
    if (!ids.length) return false;
    await db().from("notifications").insert(
      ids.map((user_id) => ({ user_id, type: m.type, title: m.title, body: m.body, link: m.path, content_type: "listening" })),
    );
    await pushTo(ids, { title: m.title, body: m.body, url: m.path, tag: m.tag });
    return true;
  } catch (err) {
    console.error("[alerts] broadcast failed", err);
    return false;
  }
}
