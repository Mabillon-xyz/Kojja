import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ConditionalSidebar from "@/components/ConditionalSidebar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Koj²a",
  description: "Personal toolbox",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <div className="flex h-screen bg-background">
          <ConditionalSidebar />
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
