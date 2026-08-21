import type { Metadata } from "next";
import KidsClient from "./KidsClient";

export const metadata: Metadata = {
  title: "Kids Mode — Draw, Trace and Save",
  description:
    "A calm, ad-free drawing and letter-tracing space for younger children, with saved creations parents can review in Cleanote.",
  alternates: {
    canonical: "/kids"
  },
  openGraph: {
    title: "Kids Mode — Draw, Trace and Save | Cleanote",
    description:
      "A calm, ad-free drawing and letter-tracing space for younger children, with saved creations parents can review in Cleanote.",
    url: "/kids",
    type: "website"
  },
  twitter: {
    title: "Kids Mode — Draw, Trace and Save | Cleanote",
    description:
      "A calm, ad-free drawing and letter-tracing space for younger children, with saved creations parents can review in Cleanote."
  }
};

export default function KidsModePage() {
  return <KidsClient />;
}
