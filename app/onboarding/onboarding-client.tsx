"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ArrowRight, ArrowLeft, Building2, MapPin, Heart, ScrollText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { FEMTORSHIP_QUESTIONS, FOCUS_AREAS, FEMTOR_QUALITIES } from "@/lib/data";
import { completeOnboarding } from "@/app/actions/onboarding";
import { PickWithOther } from "@/components/femtorship/pick-fields";

interface County { id: string; name: string; is_active: boolean }
interface Org { id: string; name: string; county_network_id: string | null; verification_status: string }

function MultiPills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              on ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050",
            )}
          >
            {on && <Check className="w-3.5 h-3.5" />} {o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange }: { value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[
        { l: "Yes", v: true },
        { l: "No", v: false },
      ].map((o) => (
        <button
          key={o.l}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-xl border px-5 py-2 text-sm font-semibold transition-colors",
            value === o.v ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const STEPS = ["Terms", "You", "Your organisation", "Femtorship"];

export function OnboardingWizard({
  defaultName,
  counties,
  organizations,
}: {
  defaultName: string;
  counties: County[];
  organizations: Org[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 0 — terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // step 1
  const [fullName, setFullName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [countyId, setCountyId] = useState("");

  // step 2
  const [orgMode, setOrgMode] = useState<"join" | "create">("join");
  const [orgId, setOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDesc, setNewOrgDesc] = useState("");

  // step 3
  const [inLeadership, setInLeadership] = useState<boolean>();
  const [leadershipDetail, setLeadershipDetail] = useState("");
  const [hasGuide, setHasGuide] = useState<boolean>();
  const [relationship, setRelationship] = useState("");
  const [barriers, setBarriers] = useState("");
  const [wantsMentor, setWantsMentor] = useState<boolean>();
  const [qualities, setQualities] = useState<string[]>([]);
  const [guidanceAreas, setGuidanceAreas] = useState<string[]>([]);
  const [canProvide, setCanProvide] = useState<boolean>();
  const [supportOffered, setSupportOffered] = useState<string[]>([]);
  const [supportDetail, setSupportDetail] = useState("");

  const orgsInCounty = useMemo(
    () => organizations.filter((o) => !countyId || o.county_network_id === countyId),
    [organizations, countyId],
  );

  const canNext =
    step === 0
      ? termsAccepted
      : step === 1
        ? fullName.trim().length > 1 && countyId
        : step === 2
          ? orgMode === "join"
            ? !!orgId
            : newOrgName.trim().length > 1
          : true;

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await completeOnboarding({
      terms_accepted: termsAccepted,
      full_name: fullName.trim(),
      title: title.trim() || undefined,
      county_network_id: countyId,
      organization_id: orgMode === "join" ? orgId : undefined,
      new_org_name: orgMode === "create" ? newOrgName.trim() : undefined,
      new_org_description: orgMode === "create" ? newOrgDesc.trim() : undefined,
      in_leadership_role: inLeadership,
      leadership_detail: leadershipDetail || undefined,
      has_guide: hasGuide,
      relationship_nature: relationship || undefined,
      barriers: barriers || undefined,
      wants_mentor: wantsMentor,
      desired_qualities: qualities,
      guidance_areas: guidanceAreas,
      can_provide: canProvide,
      support_offered: supportOffered,
      support_detail: supportDetail || undefined,
    });
    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen brand-wash py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  i <= step ? "bg-purple text-white" : "bg-surface border border-line text-muted",
                )}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium hidden sm:block", i <= step ? "text-ink" : "text-muted")}>{s}</span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-line" />}
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-3xl border border-line shadow-sm p-6 sm:p-8">
          {/* STEP 0 — TERMS */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-black text-ink flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-purple" /> Welcome to the Hub
                </h1>
                <p className="text-sm text-muted mt-1">
                  Before you begin, please review and accept our terms. You only do this once for the Hub.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-paper p-5 text-sm text-ink/80 leading-relaxed space-y-3 max-h-64 overflow-y-auto feed-scroll">
                <p className="font-semibold text-ink">A safe, respectful space</p>
                <p>The Hub is a community for women human rights defenders. By joining, you agree to treat other members with respect, to keep shared information within the community private, and to use the platform in good faith.</p>
                <p>Content you post is reviewed by the Hub before it is published. The Hub may edit or decline content that puts anyone at risk. You keep ownership of what you share.</p>
                <p>Your data is handled with care. Femtorship answers are used only to suggest matches, and your identity stays private until you choose to connect. You can read the full policies any time.</p>
                <p className="text-xs text-muted">
                  See the full <Link href="https://whrdhub.org" target="_blank" className="text-purple underline">terms and privacy policy</Link>.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-line text-purple focus:ring-purple/30"
                />
                <span className="text-sm text-ink">
                  I have read and agree to the Hub&apos;s terms of use, code of conduct, and privacy policy.
                </span>
              </label>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-black text-ink flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple" /> Tell us who you are
                </h1>
                <p className="text-sm text-muted mt-1">This helps your network find and support you.</p>
              </div>
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Your role or profession <span className="text-muted font-normal">(optional)</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lawyer, Advocate, Community organiser" />
              </div>
              <div>
                <Label>County network</Label>
                <select
                  value={countyId}
                  onChange={(e) => setCountyId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30"
                >
                  <option value="">Choose your county...</option>
                  <optgroup label="Live on the Hub">
                    {counties.filter((c) => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Other counties">
                    {counties.filter((c) => !c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-black text-ink flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple" /> Your organisation
                </h1>
                <p className="text-sm text-muted mt-1">
                  Join an organisation already on the Hub, or add a new one. New organisations are
                  verified by the Hub before they go public.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrgMode("join")}
                  className={cn("flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold", orgMode === "join" ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink")}
                >
                  Join existing
                </button>
                <button
                  type="button"
                  onClick={() => setOrgMode("create")}
                  className={cn("flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold", orgMode === "create" ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink")}
                >
                  Add a new one
                </button>
              </div>

              {orgMode === "join" ? (
                <div>
                  <Label>Choose your organisation</Label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30"
                  >
                    <option value="">Select...</option>
                    {orgsInCounty.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}{o.verification_status !== "verified" ? " (pending verification)" : ""}
                      </option>
                    ))}
                  </select>
                  {orgsInCounty.length === 0 && (
                    <p className="text-xs text-muted mt-2">
                      No organisations in this county yet. Switch to &quot;Add a new one&quot; to create the first.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Organisation name</Label>
                    <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g. Kitui Women Defenders CBO" />
                  </div>
                  <div>
                    <Label>What does it do? <span className="text-muted font-normal">(optional)</span></Label>
                    <Textarea rows={3} value={newOrgDesc} onChange={(e) => setNewOrgDesc(e.target.value)} placeholder="A sentence or two about your organisation." />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-ink flex items-center gap-2">
                  <Heart className="w-5 h-5 text-magenta" /> Femtorship
                </h1>
                <p className="text-sm text-muted mt-1">
                  We use this to pair defenders. You can be a femtor and a femtee at the same time.
                </p>
              </div>

              <div className="space-y-2">
                <Label>{FEMTORSHIP_QUESTIONS.in_leadership_role}</Label>
                <YesNo value={inLeadership} onChange={setInLeadership} />
                {inLeadership && (
                  <Input className="mt-2" value={leadershipDetail} onChange={(e) => setLeadershipDetail(e.target.value)} placeholder={FEMTORSHIP_QUESTIONS.leadership_detail} />
                )}
              </div>

              <div className="space-y-2">
                <Label>{FEMTORSHIP_QUESTIONS.has_guide}</Label>
                <YesNo value={hasGuide} onChange={setHasGuide} />
                {hasGuide && (
                  <Input className="mt-2" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={FEMTORSHIP_QUESTIONS.relationship_nature} />
                )}
              </div>

              <div className="rounded-2xl border border-line bg-purple-050/40 p-4 space-y-4">
                <p className="text-sm font-bold text-purple">As a femtee (someone seeking guidance)</p>
                <div className="space-y-2">
                  <Label>{FEMTORSHIP_QUESTIONS.barriers}</Label>
                  <Textarea rows={2} value={barriers} onChange={(e) => setBarriers(e.target.value)} placeholder="Share what has made it hard, and whether you would like a femtor." />
                  <div className="pt-1"><YesNo value={wantsMentor} onChange={setWantsMentor} /></div>
                  <p className="text-xs text-muted">I would like to be matched with a femtor.</p>
                </div>
                <div className="space-y-2">
                  <Label>{FEMTORSHIP_QUESTIONS.guidance_areas}</Label>
                  <PickWithOther options={FOCUS_AREAS} value={guidanceAreas} onChange={setGuidanceAreas} max={3} />
                </div>
                <div className="space-y-2">
                  <Label>{FEMTORSHIP_QUESTIONS.desired_qualities}</Label>
                  <MultiPills options={FEMTOR_QUALITIES} value={qualities} onChange={setQualities} />
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-magenta-050/40 p-4 space-y-4">
                <p className="text-sm font-bold text-magenta">As a femtor (someone offering guidance)</p>
                <div className="space-y-2">
                  <Label>{FEMTORSHIP_QUESTIONS.can_provide}</Label>
                  <YesNo value={canProvide} onChange={setCanProvide} />
                </div>
                {canProvide && (
                  <>
                    <div className="space-y-2">
                      <Label>{FEMTORSHIP_QUESTIONS.support_offered}</Label>
                      <PickWithOther options={FOCUS_AREAS} value={supportOffered} onChange={setSupportOffered} />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>{FEMTORSHIP_QUESTIONS.support_detail}</Label>
                <Textarea rows={2} value={supportDetail} onChange={(e) => setSupportDetail(e.target.value)} placeholder="Optional, e.g. access needs, language, availability" />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Nav */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || loading}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finish and enter the Hub"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
