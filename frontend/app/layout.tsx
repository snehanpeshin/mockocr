import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cleanote.in"),
  title: {
    default: "Cleanote | Scan Handwritten Notes into Editable Text",
    template: "%s | Cleanote"
  },
  description:
    "Capture handwritten notes, printed handouts, and annotated pages as editable text you can review, save, and export.",
  applicationName: "Cleanote",
  category: "productivity",
  keywords: [
    "handwriting scanning app",
    "digital handwritten notes",
    "scan and organize notes",
    "note capture app",
    "student note organization"
  ],
  openGraph: {
    description:
      "Scan handwritten notes, worksheets, research pages, and annotated documents into searchable text.",
    images: ["/cleanote-icon.png"],
    siteName: "Cleanote",
    title: "Cleanote | Scan Handwritten Notes into Editable Text",
    type: "website",
    url: "/"
  },
  twitter: {
    card: "summary",
    description:
      "Scan handwritten notes, worksheets, research pages, and annotated documents into searchable text.",
    images: ["/cleanote-icon.png"],
    title: "Cleanote | Scan Handwritten Notes into Editable Text"
  },
  icons: {
    apple: "/cleanote-icon.png",
    icon: "/cleanote-icon.png"
  },
  manifest: "/manifest.webmanifest",
  robots: {
    follow: true,
    index: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-6605747981994820" />
        <script
          async
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6605747981994820"
        />
      </head>
      <body>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18239515056"
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18239515056');
          `}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
