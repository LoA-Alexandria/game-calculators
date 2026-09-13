import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit artwork layouts",
  robots: { index: false, follow: false },
};

export default function EditArtworkLayoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
