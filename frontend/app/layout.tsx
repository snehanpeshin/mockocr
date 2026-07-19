import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cleanote.in"),
  title: {
    default: "Cleanote | Handwritten Notes to Searchable Documents",
    template: "%s | Cleanote"
  },
  description:
    "Convert handwritten notes, worksheets, and annotated pages into editable text with Cleanote.",
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
      "Convert handwritten notes, worksheets, and annotated pages into editable text with Cleanote.",
    images: ["/cleanote-icon.png"],
    siteName: "Cleanote",
    title: "Cleanote | Handwritten Notes to Searchable Documents",
    type: "website",
    url: "/"
  },
  twitter: {
    card: "summary",
    description:
      "Convert handwritten notes, worksheets, and annotated pages into editable text with Cleanote.",
    images: ["/cleanote-icon.png"],
    title: "Cleanote | Handwritten Notes to Searchable Documents"
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
