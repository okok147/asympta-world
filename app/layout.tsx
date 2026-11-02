import type { Metadata, Viewport } from "next";
import "./paper-world.css";

const faviconPath = process.env.ASYMPTA_PAGES_BUILD === "1"
  ? "/asympta-world/favicon-asympta-cat-20260829.svg"
  : "/favicon-asympta-cat-20260829.svg";

export const metadata: Metadata = {
  title: "Asympta World",
  description: "A quiet world on a sheet of paper.",
  icons: { icon: [{ url: faviconPath, type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5ed",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
