import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Karigari Beta Access",
  description: "Private Karigari beta access page.",
  alternates: { canonical: "/beta/" },
  robots: { index: false, follow: false }
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
