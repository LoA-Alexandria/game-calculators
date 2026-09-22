import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./components/AuthProvider";
import { LocaleProvider } from "./components/LocaleProvider";
import { SCHEME_STORAGE_KEY, THEME_STORAGE_KEY } from "../lib/site";
import "./globals.css";

/**
 * Fonts are self-hosted by Next at build time rather than fetched from Google
 * at page load, so there is no render-blocking third-party request. Each one
 * exposes a CSS variable that `globals.css` folds into its type tokens.
 */
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sora", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Pop Epoch Tools · LoA Alexandria",
    template: "%s · Pop Epoch Tools",
  },
  description:
    "Community-built calculators, guides, and planners for Pop Epoch: events, Goddess progression, Grand Voyage, and the irrigation field layout. Available in English, German, and French.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3eee6" },
    { media: "(prefers-color-scheme: dark)", color: "#12100d" },
  ],
};

/**
 * Applies the stored theme and colour scheme before first paint so a stored
 * choice that differs from the defaults does not flash the wrong palette. The
 * language cannot be handled this way — the exported HTML carries the default
 * language and `LocaleProvider` swaps it as soon as React hydrates.
 */
const themeBootstrap = `(function(){try{var d=document.documentElement;var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")d.dataset.theme=t;var s=localStorage.getItem(${JSON.stringify(SCHEME_STORAGE_KEY)});if(s==="stone"||s==="lapis"||s==="papyrus"||s==="steam")d.dataset.scheme=s;}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the script below sets `data-theme` and
    // `data-scheme`, and LocaleProvider sets `lang`, all before React hydrates.
    // It only covers this element's own attributes, not the tree underneath.
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <LocaleProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
