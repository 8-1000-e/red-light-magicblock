import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const pixelFont = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "1, 2, 3... SOL-eil",
  description: "Red Light Green Light — powered by SOL price on MagicBlock",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pixelFont.variable} h-full`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-pixel)]">{children}</body>
    </html>
  );
}
