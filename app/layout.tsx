import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koj²a",
  description: "Prospection intelligente pour coachs business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
