import type { Metadata } from "next";
import { Orbitron, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Marshall OS — AI Command Center",
  description:
    "Personal AI command center and orchestration layer. Internal assistant: JARVIS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${ibmPlex.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
