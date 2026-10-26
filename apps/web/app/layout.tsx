import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "jobfox" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
