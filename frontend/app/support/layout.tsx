import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Karigari scanning, accounts, purchases, privacy, and data deletion.",
  alternates: { canonical: "/support/" }
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
