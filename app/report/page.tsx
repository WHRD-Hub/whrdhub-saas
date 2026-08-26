import Link from "next/link";
import { Shield, ArrowLeft, Lock } from "lucide-react";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ReportForm from "@/components/reporting/report-form";
import { LangSwitcher } from "@/components/reporting/lang-switcher";
import { LanguageOnboardingModal } from "@/components/reporting/language-onboarding-modal";
import { QuickExit, QuickExitButton } from "@/components/reporting/quick-exit";

export const metadata = {
  title: "Make a Report | WHRD Hub",
  description:
    "Securely report TFGBV or abuse. Your report is encrypted and handled with care by WHRD Hub defenders.",
};

async function ReportFormWithAuth() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const isAuthenticated = !!user;
  const userEmail = user?.email ?? undefined;
  return <ReportForm isAuthenticated={isAuthenticated} userEmail={userEmail} />;
}

export default function ReportPage() {
  return (
    <main className="min-h-screen bg-paper">

      <LanguageOnboardingModal />
      <QuickExit />

      {/* Header */}
      <header className="bg-purple text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/main-logo.png" alt="WHRD Hub" className="h-7 w-auto brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/80">
              <Lock className="w-4 h-4" />
              <span>Secure and confidential</span>
            </div>
            <LangSwitcher variant="compact" className="[&>button]:bg-white/10 [&>button]:border-white/20 [&>button]:text-white [&>button]:hover:bg-white/20" />
          </div>
        </div>
      </header>

      {/* Quick exit notice */}
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5">
        <p className="text-center text-xs text-amber-800 max-w-2xl mx-auto">
          <strong>Quick exit:</strong> Press <kbd className="bg-amber-200 px-1.5 py-0.5 rounded text-xs font-mono">Esc</kbd> twice or{" "}
          <QuickExitButton className="underline font-semibold" />{" "}
          to leave immediately. Use private/incognito mode if needed.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-purple/10 text-purple rounded-full px-3 sm:px-4 py-1.5 text-xs font-semibold mb-3 sm:mb-4">
            <Shield className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            Your report is encrypted
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-purple mb-2">Report safely</h1>
          <p className="text-muted text-sm max-w-xl mx-auto leading-relaxed">
            You are not alone. Share only what feels comfortable. Your IP address is not recorded.
          </p>
        </div>

        <Suspense fallback={
          <div className="py-16 text-center text-muted text-sm">
            <div className="w-6 h-6 border-2 border-purple/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            Loading form...
          </div>
        }>
          <ReportFormWithAuth />
        </Suspense>
      </div>
    </main>
  );
}
