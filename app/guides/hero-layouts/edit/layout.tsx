import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit hero layouts",
  robots: { index: false, follow: false },
};

export default function EditHeroLayoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
