import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARVIN Operations Console",
  description: "MARVIN agent operations dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
