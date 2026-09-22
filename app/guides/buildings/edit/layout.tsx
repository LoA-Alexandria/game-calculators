import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit buildings",
  robots: { index: false, follow: false },
};

export default function EditBuildingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
