import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const metadataBase = (() => {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  return siteUrl ? new URL(siteUrl) : new URL("http://localhost:3000");
})();

export const metadata: Metadata = {
  metadataBase,
  title: "Ordinal 1",
  description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "Ordinal 1",
    description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ordinal 1",
    description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
