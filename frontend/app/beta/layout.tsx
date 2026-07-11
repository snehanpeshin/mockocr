import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta Access",
  robots: { index: false, follow: false }
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
