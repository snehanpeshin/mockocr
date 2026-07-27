import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cleanote Admin Dashboard",
  description: "Private Cleanote admin dashboard.",
  alternates: { canonical: "/admin/" },
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
