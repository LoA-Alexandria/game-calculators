import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pop Epoch Tools · LoA Alexandria",
  description: "Community-built calculators for Pop Epoch events, progression, and Grand Voyage.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
