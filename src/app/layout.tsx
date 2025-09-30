import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineIndicator from "@/components/OfflineIndicator";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hashtag",
  description: "Event photo gallery with Supabase storage",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo icon.png",
    shortcut: "/logo icon.png",
    apple: "/logo icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hashtag",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
        <link rel="apple-touch-icon" href="/logo icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Hashtag" />
        <meta name="microphone" content="deny" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <div className="min-h-screen bg-white">
            {children}
          </div>
          <PWARegister />
          <OfflineIndicator />
        </ToastProvider>
      </body>
    </html>
  );
}
