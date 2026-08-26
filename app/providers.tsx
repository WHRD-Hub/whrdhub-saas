"use client";

import { LanguageProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/toast";

/**
 * Client-side providers for the merged app.
 *
 * The reporting platform's language context now wraps the whole product, so
 * the report form, the member dashboard and the Hub console all render in the
 * language the visitor chose.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      {children}
      <Toaster />
    </LanguageProvider>
  );
}
