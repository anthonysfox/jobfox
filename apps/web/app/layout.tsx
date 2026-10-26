import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "jobfox", description: "Scored jobs to review and apply to" };

const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/label", label: "Label" },
  { href: "/eval", label: "Eval" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/jobs" className="font-semibold tracking-tight">
              jobfox
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
