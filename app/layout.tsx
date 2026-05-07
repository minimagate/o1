import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const metadataBase = (() => {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  return siteUrl
    ? new URL(normalizeSiteUrl(siteUrl))
    : new URL("http://localhost:3000");
})();

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("hhtps://")) {
    return `https://${trimmed.slice("hhtps://".length)}`;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export const metadata: Metadata = {
  metadataBase,
  title: "Ordinal 1",
  description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Ordinal 1",
    description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ordinal 1",
    description: "Daily refreshed AI model table powered by Vercel Cron and Blob.",
    images: ["/twitter-image"],
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
