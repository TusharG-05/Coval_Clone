import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import {
  LayoutDashboard,
} from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Coval Clone Dashboard",
  description: "A clone of the Coval AI Platform for agent evaluation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex h-screen overflow-hidden">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
              <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-4">
                  <button className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                    <LayoutDashboard className="h-6 w-6" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <ThemeToggle />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center text-sm font-bold text-white shadow-md">
                    U
                  </div>
                </div>
              </header>
              
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
                <div className="max-w-6xl mx-auto">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
