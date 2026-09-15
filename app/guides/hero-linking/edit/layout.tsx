import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit hero linking",
  robots: { index: false, follow: false },
};

export default function EditHeroLinkingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
