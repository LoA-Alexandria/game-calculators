import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit artwork catalogue",
  robots: { index: false, follow: false },
};

export default function EditArtworkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
