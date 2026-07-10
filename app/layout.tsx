import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import AuthBar from "@/components/AuthBar";
import { createClient } from "@/lib/supabase/server";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: "variable",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "WeeklyNom",
  description: "A household recipe library, pantry tracker, and shopping list.",
  appleWebApp: {
    capable: true,
    title: "WeeklyNom",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1b17",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isSignedIn = data.user != null;

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col font-body bg-bg text-ink">
        <header className="bg-ink px-5 py-7 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-teal-mid mb-2">
            WeeklyNom
          </div>
          <h1 className="font-display text-2xl font-light text-white leading-tight mb-1">
            Eat better <em className="italic text-teal-mid">without trying</em>.
          </h1>
          <p className="text-xs text-[#706860]">
            Recipes · Weekly planning · Pantry · Shopping list
          </p>
        </header>
        {isSignedIn && <TopNav />}
        <AuthBar />
        <main className="flex-1 px-4 pt-5 pb-16">{children}</main>
      </body>
    </html>
  );
}
