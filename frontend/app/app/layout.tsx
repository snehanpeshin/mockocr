import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Scanner",
  description: "Upload a note image, PDF, screenshot, or DOCX file and review the extracted text.",
  alternates: { canonical: "/app/" },
  robots: { index: false, follow: true }
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
