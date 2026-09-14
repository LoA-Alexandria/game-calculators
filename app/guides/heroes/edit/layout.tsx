import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit heroes",
  robots: { index: false, follow: false },
};

export default function EditHeroesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
