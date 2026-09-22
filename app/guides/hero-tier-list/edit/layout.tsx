import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit hero tier list",
  robots: { index: false, follow: false },
};

export default function EditHeroTierListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
