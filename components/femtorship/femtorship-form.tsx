"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { FEMTORSHIP_QUESTIONS, FOCUS_AREAS, FEMTOR_QUALITIES } from "@/lib/data";
import { saveFemtorship } from "@/app/actions/profile";
import { PickWithOther } from "@/components/femtorship/pick-fields";

type Fem = Record<string, unknown> | null;

function Pills({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => toggle(o)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", on ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050")}>
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
      {[{ l: "Yes", v: true }, { l: "No", v: false }].map((o) => (
        <button key={o.l} type="button" onClick={() => onChange(o.v)}
          className={cn("rounded-xl border px-5 py-2 text-sm font-semibold", value === o.v ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function FemtorshipForm({ fem, onSaved }: { fem: Fem; onSaved?: () => void }) {
  const f = (fem ?? {}) as Record<string, unknown>;
  const [inLeadership, setInLeadership] = useState<boolean | undefined>(f.in_leadership_role as boolean | undefined);
  const [leadershipDetail, setLeadershipDetail] = useState((f.leadership_detail as string) ?? "");
  const [hasGuide, setHasGuide] = useState<boolean | undefined>(f.has_guide as boolean | undefined);
  const [barriers, setBarriers] = useState((f.barriers as string) ?? "");
  const [wantsMentor, setWantsMentor] = useState<boolean | undefined>(f.wants_mentor as boolean | undefined);
  const [qualities, setQualities] = useState<string[]>((f.desired_qualities as string[]) ?? []);
  const [guidance, setGuidance] = useState<string[]>((f.guidance_areas as string[]) ?? []);
  const [canProvide, setCanProvide] = useState<boolean | undefined>(f.can_provide as boolean | undefined);
  const [support, setSupport] = useState<string[]>((f.support_offered as string[]) ?? []);
  const [relationship, setRelationship] = useState((f.relationship_nature as string) ?? "");
  const [supportDetail, setSupportDetail] = useState((f.support_detail as string) ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setLoading(true);
    await saveFemtorship({
      in_leadership_role: inLeadership, leadership_detail: leadershipDetail, has_guide: hasGuide, relationship_nature: relationship,
      barriers, wants_mentor: wantsMentor, desired_qualities: qualities, guidance_areas: guidance,
      can_provide: canProvide, support_offered: support, support_detail: supportDetail,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved?.();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.in_leadership_role}</Label><YesNo value={inLeadership} onChange={setInLeadership} />
        {inLeadership && <Input className="mt-2" value={leadershipDetail} onChange={(e) => setLeadershipDetail(e.target.value)} placeholder={FEMTORSHIP_QUESTIONS.leadership_detail} />}</div>
      <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.has_guide}</Label><YesNo value={hasGuide} onChange={setHasGuide} />
        {hasGuide && <Input className="mt-2" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={FEMTORSHIP_QUESTIONS.relationship_nature} />}</div>
      <div className="rounded-2xl border border-line bg-purple-050/40 p-4 space-y-4">
        <p className="text-sm font-bold text-purple-700">As a femtee</p>
        <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.barriers}</Label><Textarea rows={2} value={barriers} onChange={(e) => setBarriers(e.target.value)} /><div className="pt-1"><YesNo value={wantsMentor} onChange={setWantsMentor} /></div><p className="text-xs text-muted">I would like to be matched with a femtor.</p></div>
        <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.guidance_areas}</Label><PickWithOther options={FOCUS_AREAS} value={guidance} onChange={setGuidance} max={3} /></div>
        <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.desired_qualities}</Label><Pills options={FEMTOR_QUALITIES} value={qualities} onChange={setQualities} /></div>
      </div>
      <div className="rounded-2xl border border-line bg-magenta-050/40 p-4 space-y-4">
        <p className="text-sm font-bold text-magenta-700">As a femtor</p>
        <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.can_provide}</Label><YesNo value={canProvide} onChange={setCanProvide} /></div>
        {canProvide && <div className="space-y-2"><Label>{FEMTORSHIP_QUESTIONS.support_offered}</Label><PickWithOther options={FOCUS_AREAS} value={support} onChange={setSupport} /></div>}
      </div>
      <div className="space-y-2">
        <Label>{FEMTORSHIP_QUESTIONS.support_detail}</Label>
        <Textarea rows={2} value={supportDetail} onChange={(e) => setSupportDetail(e.target.value)} placeholder="Optional, e.g. access needs, language, availability" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save answers"}
        </button>
        {saved && <span className="text-sm text-emerald-700 font-semibold">Saved.</span>}
      </div>
    </div>
  );
}
