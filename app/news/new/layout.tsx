import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New news entry",
  robots: { index: false, follow: false },
};

export default function NewNewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
