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

export const metadata: Metadata = {
  title: "checkwith.us | Family payment protection",
  description: "Family approval for risky payments, with scam detection on the phone.",
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
