import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Premium Checkout",
  description: "One-time Cleanote web premium checkout, separate from mobile app-store purchases.",
  alternates: { canonical: "/billing/" },
  robots: { index: false, follow: false }
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
