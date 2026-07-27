import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cleanote Beta Access",
  description: "Private Cleanote beta access page.",
  alternates: { canonical: "/beta/" },
  robots: { index: false, follow: false }
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
