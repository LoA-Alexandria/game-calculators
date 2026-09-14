import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Goddess Theater",
  robots: { index: false, follow: false },
};

export default function EditGoddessTheaterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
