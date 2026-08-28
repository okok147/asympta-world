import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./asympta-restoration.css";

export const metadata: Metadata = {
  title: "Asympta World · Humans live. Agents coordinate.",
  description: "A calm living world where one human intention coordinates business, supplier, production, finance, logistics and support agents end to end.",
  applicationName: "Asympta World",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#eeede6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className="antialiased">{children}</body></html>;
}
