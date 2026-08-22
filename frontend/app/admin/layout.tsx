import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Karigari Home LLC Admin Dashboard",
  description: "Private Karigari admin dashboard.",
  alternates: { canonical: "/admin/" },
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
