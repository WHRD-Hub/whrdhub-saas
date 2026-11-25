"use client";

import { LanguageProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/toast";
import { SiteContentProvider } from "@/components/site-edit/site-content-provider";
import { EditBar } from "@/components/site-edit/edit-bar";

/**
 * Client-side providers for the merged app.
 *
 * The reporting platform's language context now wraps the whole product, so
 * the report form, the member dashboard and the Hub console all render in the
 * language the visitor chose.
 */
export function Providers({ children, siteContent = {} }: { children: React.ReactNode; siteContent?: Record<string, string> }) {
  return (
    <LanguageProvider>
      <SiteContentProvider published={siteContent}>
        {children}
        <EditBar />
      </SiteContentProvider>
      <Toaster />
    </LanguageProvider>
  );
}
