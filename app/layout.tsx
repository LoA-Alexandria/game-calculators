import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Calculators · LoA Alexandria",
  description: "Open, focused, and reliable calculators for games.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
