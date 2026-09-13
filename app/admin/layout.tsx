import type { Metadata } from "next";

/**
 * Admin routes are part of the static export, so the page itself is public.
 * What it can read and write is decided by row-level security in Supabase, not
 * by this file — noindex only keeps it out of search results.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
