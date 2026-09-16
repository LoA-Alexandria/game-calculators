import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit server age unlocks",
  robots: { index: false, follow: false },
};

export default function EditServerAgeUnlocksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
