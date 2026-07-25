import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cleanote.in"),
  title: {
    default: "Handwriting to Text for Students | Cleanote",
    template: "%s | Cleanote"
  },
  description:
    "Convert handwritten notes, worksheets, equations, and study pages into editable, searchable text with Cleanote's handwriting-first scanner.",
  applicationName: "Cleanote",
  category: "productivity",
  keywords: [
    "handwriting to text",
    "convert handwritten notes to text",
    "handwriting OCR",
    "homework scanner app",
    "handwriting scanning app",
    "digital handwritten notes",
    "scan and organize notes",
    "note capture app",
    "student note organization"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    description:
      "Convert handwritten notes, worksheets, equations, and study pages into editable, searchable text with Cleanote's handwriting-first scanner.",
    images: ["/cleanote-icon.png"],
    siteName: "Cleanote",
    title: "Handwriting to Text for Students | Cleanote",
    type: "website",
    url: "/"
  },
  twitter: {
    card: "summary",
    description:
      "Convert handwritten notes, worksheets, equations, and study pages into editable, searchable text with Cleanote's handwriting-first scanner.",
    images: ["/cleanote-icon.png"],
    title: "Handwriting to Text for Students | Cleanote"
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

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.cleanote.in/#organization",
      name: "Cleanote",
      legalName: "Karigari Home LLC",
      url: "https://www.cleanote.in/",
      logo: "https://www.cleanote.in/cleanote-icon.png",
      sameAs: [
        "https://apps.apple.com/app/cleanote/id6784403759",
        "https://play.google.com/store/apps/details?id=com.cleanote.app",
        "https://www.facebook.com/profile.php?id=61591217794113",
        "https://www.instagram.com/cleanote4/"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.cleanote.in/#website",
      name: "Cleanote",
      url: "https://www.cleanote.in/",
      publisher: {
        "@id": "https://www.cleanote.in/#organization"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.cleanote.in/#software",
      name: "Cleanote",
      applicationCategory: "EducationalApplication",
      operatingSystem: "iOS, Android, Web",
      url: "https://www.cleanote.in/",
      description:
        "Cleanote converts handwritten notes, worksheets, equations, and study pages into editable, searchable text.",
      publisher: {
        "@id": "https://www.cleanote.in/#organization"
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD"
      }
    }
  ]
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          type="application/ld+json"
        />
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
