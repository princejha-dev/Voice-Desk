import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "VoiceDesk — AI Voice Agents for Every Business",
  description: "Set up a 24/7 AI receptionist in 10 minutes. Multi-tenant voice AI platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

