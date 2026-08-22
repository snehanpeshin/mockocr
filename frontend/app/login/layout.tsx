import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to supported Karigari web account features.",
  alternates: { canonical: "/login/" },
  robots: { index: false, follow: false }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
