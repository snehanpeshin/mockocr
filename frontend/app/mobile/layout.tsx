import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download the Cleanote App",
  description: "Download Cleanote for iPhone. Android availability is coming soon.",
  alternates: { canonical: "/mobile/" }
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
