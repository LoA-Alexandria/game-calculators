import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Museion",
  robots: { index: false, follow: false },
};

export default function EditMuseionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
