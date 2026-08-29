import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";
import "./asympta-animal-art.css";

export const metadata: Metadata = {
  title: "Asympta World",
  description: "A calm, map-first spatial world.",
  applicationName: "Asympta World",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
