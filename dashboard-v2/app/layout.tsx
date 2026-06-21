import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARVIN Dashboard V2",
  description: "MARVIN command center dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
