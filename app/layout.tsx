import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acadza Review Desk",
  description: "Faculty review of reported question issues",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
