import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit collection",
  robots: { index: false, follow: false },
};

export default function EditCollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
