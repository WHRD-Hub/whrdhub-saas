"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check, ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";

function SuccessContent() {
  const params   = useSearchParams();
  const reportId = params.get("rid") || "";
  const t = useT();
  const s = t.success;

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-5 py-16">
      <div className="max-w-md w-full space-y-5">

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-ink mb-2">{s.title}</h1>
          <p className="text-muted text-sm leading-relaxed">{s.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl border border-line p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-sm text-ink">{s.nextSteps}</h2>
          <ol className="space-y-3">
            {s.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted">
                <span className="w-5 h-5 rounded-full bg-purple/10 text-purple text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-purple/5 border border-purple/20 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-purple mb-1">{s.alreadySignedIn}</p>
          <p className="text-muted text-xs">{s.credentialsSub}</p>
        </div>

        {reportId && (
          <p className="text-center text-xs font-mono text-muted">
            {s.caseRef}: {reportId}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button href="/dashboard/reports" className="w-full">
            {s.goToDashboard} <ArrowRight className="w-4 h-4" />
          </Button>
          <Button href="/" variant="outline" className="w-full">
            {s.returnHome}
          </Button>
        </div>

        <div className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
          <Phone className="w-3 h-3" />
          {s.inDanger}{" "}
          <a href="tel:999" className="font-bold text-rose-600">999</a>
          {" or "}
          <a href="tel:1195" className="font-bold text-rose-600">1195 (GBV Helpline)</a>
        </div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
