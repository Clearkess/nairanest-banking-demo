import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NairaNest — Modern digital banking",
  description: "A modern digital banking experience. Demo environment until regulated banking partners and production controls are configured.",
  applicationName: "NairaNest",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
