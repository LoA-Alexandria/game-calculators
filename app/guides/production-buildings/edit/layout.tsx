import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit production buildings",
  robots: { index: false, follow: false },
};

export default function EditProductionBuildingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
