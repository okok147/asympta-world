import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./asympta-animal-art.css";
import "./asympta-intent-world.css";
import "./asympta-intent-console.css";
import "./asympta-intent-runtime.css";

const faviconPath = process.env.ASYMPTA_PAGES_BUILD === "1"
  ? "/asympta-world/favicon-asympta-cat-20260829.svg"
  : "/favicon-asympta-cat-20260829.svg";

export const metadata: Metadata = {
  title: "Asympta World — Intention to Coordinated Action",
  description: "A calm intention-first multi-agent simulation with validated task planning, deterministic execution, and human approval boundaries.",
  applicationName: "Asympta World",
  icons: {
    icon: [{ url: faviconPath, type: "image/svg+xml" }],
    shortcut: faviconPath,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f0e8",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
