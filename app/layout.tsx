import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import "./globals.css";
import { AccessibilityWidget } from "@/components/accessibility-widget";
import { SignInPrompt } from "@/components/signin-prompt";
import { GuestReactionSync } from "@/components/guest-reaction-sync";
import { Providers } from "./providers";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { OfflineSyncManager } from "@/components/pwa/offline-sync-manager";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const LOGO = "/main-logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "WHRD Hub", "women human rights defenders", "Kenya", "femtorship", "mentorship",
    "gender", "human rights", "TFGBV", "advocacy", "community",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: SITE_NAME },
  icons: { icon: LOGO, shortcut: LOGO, apple: "/apple-touch-icon.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_KE",
    // Image comes from app/opengraph-image.tsx automatically.
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#734E9E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <AccessibilityWidget />
        <SignInPrompt />
        <GuestReactionSync />
        <ServiceWorkerRegistrar />
        <OfflineSyncManager />
        <InstallPrompt />
      </body>
    </html>
  );
}
