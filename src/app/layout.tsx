import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Apex Racing — Live Race Strategy Ops",
  description:
    "Integrated command center for real-time race strategy: discrete-event simulator, 3D track visualization, strategy tree, rules-based alerts, and one-click pit radio link.",
  keywords: [
    "F1",
    "racing strategy",
    "race simulation",
    "pit stop",
    "telemetry",
    "command center",
    "Apex Racing",
  ],
  authors: [{ name: "Apex Racing Strategy" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "#0f172a",
              border: "1px solid rgba(220,38,38,0.3)",
              color: "#e2e8f0",
            },
          }}
        />
      </body>
    </html>
  );
}
