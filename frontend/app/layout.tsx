import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cleanote.in"),
  title: {
    default: "Cleanote",
    template: "%s | Cleanote"
  },
  description:
    "Cleanote turns handwritten notes, printed handouts, equations, and annotated pages into editable, searchable text.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    description:
      "Scan handwritten notes, worksheets, research pages, and annotated documents into searchable text.",
    images: ["/cleanote-icon.png"],
    siteName: "Cleanote",
    title: "Cleanote",
    type: "website",
    url: "/"
  },
  twitter: {
    card: "summary",
    description:
      "Scan handwritten notes, worksheets, research pages, and annotated documents into searchable text.",
    images: ["/cleanote-icon.png"],
    title: "Cleanote"
  },
  icons: {
    apple: "/cleanote-icon.png",
    icon: "/cleanote-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
