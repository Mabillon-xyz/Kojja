import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koj²a",
  description: "Smart prospecting for business coaches",
  icons: {
    icon: "https://i.imgur.com/fFfn12g.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
