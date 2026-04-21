import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Weekend Escape AI — Your Perfect Getaway, Curated by AI",
  description:
    "Discover handcrafted weekend trip itineraries powered by AI. Luxury hotels, curated activities, and unforgettable destinations — all tailored to your budget.",
  keywords: ["travel", "weekend", "AI", "trip planner", "luxury travel", "itinerary"],
  openGraph: {
    title: "Weekend Escape AI",
    description: "Your perfect weekend is one click away.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf5" },
    { media: "(prefers-color-scheme: dark)",  color: "#0d0b18" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} dark`}>
      <body className="font-sans antialiased text-white bg-stone-950 relative overflow-x-hidden">
        {/* Ambient background orbs — fixed, behind everything */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="orb bg-sand-400 w-[600px] h-[600px] top-[-200px] left-[-200px] animate-spin-slow" />
          <div className="orb bg-indigo-500 w-[500px] h-[500px] top-[30%] right-[-150px]" />
          <div className="orb bg-rose-500 w-[400px] h-[400px] bottom-[-100px] left-[30%]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(13,11,24,0)_0%,rgba(13,11,24,0.8)_70%)]" />
        </div>

        {children}
      </body>
    </html>
  );
}
