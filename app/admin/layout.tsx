import type { Metadata } from "next";

/**
 * Admin routes are part of the static export, so they are publicly reachable.
 * Keeping them out of search results is the only thing this layout can do —
 * real protection needs a server. See docs/AUTH-AND-CMS.md.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
