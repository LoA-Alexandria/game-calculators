import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit collection layouts",
  robots: { index: false, follow: false },
};

export default function EditCollectionLayoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
