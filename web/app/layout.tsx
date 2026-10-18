import type { Metadata } from "next";
import { Figtree, Gabarito, Geist_Mono } from "next/font/google";
import "./globals.css";

// Brand type, shared with the mockups: Gabarito for headings, Figtree for everything else.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "checkwith.us | Scam protection the family runs";
const description = "An iPhone app for older adults. It hides scam texts, labels scam calls and pauses risky payments until someone in the family says yes.";

// The share image comes from app/opengraph-image.tsx; Next adds og:image for it.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.checkwith.us"),
  title: "checkwith.us | Family payment protection",
  description: "Family approval for risky payments, with scam detection on the phone.",
  openGraph: { type: "website", siteName: "checkwith.us", url: "/", title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${gabarito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
