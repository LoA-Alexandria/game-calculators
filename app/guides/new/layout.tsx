import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New guide",
  robots: { index: false, follow: false },
};

export default function NewGuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
