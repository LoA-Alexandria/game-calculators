import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit goddesses",
  robots: { index: false, follow: false },
};

export default function EditGoddessesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
