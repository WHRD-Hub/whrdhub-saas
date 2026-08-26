"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { LangSwitcher } from "@/components/reporting/lang-switcher";
import { ChatPanel } from "@/components/reporting/chat-panel";

export function ChatPageClient() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-[100dvh] bg-paper">
      <header className="bg-white border-b border-line shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="p-2 -ml-2 hover:bg-paper rounded-lg transition-colors" aria-label={t.chat.backToDashboard}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-purple/10 text-purple flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </span>
              <h1 className="font-bold text-ink">{t.chat.fullTitle}</h1>
            </div>
          </div>
          <LangSwitcher variant="compact" />
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-4xl w-full mx-auto bg-white border-x border-line">
        <ChatPanel fullPage />
      </main>
    </div>
  );
}
