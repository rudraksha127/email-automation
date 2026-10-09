import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/hooks/AuthContext";
import { AuthGuard, GuestGuard } from "@/routes/guards";
import { LoadingState } from "@/components/ui/EmptyState";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "IT Department — Mail Automation",
    template: "%s — IT Department Mail Automation",
  },
  description:
    "Departmental admin PWA to receive, review and forward incoming emails to the correct academic batch.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mail Automation",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-800">
        <ServiceWorkerRegister />
        <AuthProvider>
          {/* Suspense boundary: guards use usePathname(), which streams in during prerender. */}
          <Suspense fallback={<LoadingState label="Loading…" />}>
            <GuestGuard>
              <AuthGuard>{children}</AuthGuard>
            </GuestGuard>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
