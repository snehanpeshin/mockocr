import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Karigari Access Verification",
  description: "Private Karigari access verification page.",
  alternates: { canonical: "/verify/" },
  robots: { index: false, follow: false }
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
