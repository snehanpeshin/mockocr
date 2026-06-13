import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
