import type { Metadata } from "next";
import Script from "next/script";
import "./styles.css";

export const metadata: Metadata = {
  title: "Cleanote",
  description: "Upload handwritten notes and convert them into editable text."
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
        {children}
      </body>
    </html>
  );
}
