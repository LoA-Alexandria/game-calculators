import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit hero leveling",
  robots: { index: false, follow: false },
};

export default function EditHeroLevelingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
