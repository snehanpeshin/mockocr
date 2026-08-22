import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download the Karigari App",
  description: "Download Karigari for iPhone or Android.",
  alternates: { canonical: "/mobile/" }
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
