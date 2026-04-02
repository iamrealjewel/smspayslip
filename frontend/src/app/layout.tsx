import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ConfirmationProvider } from "@/context/ConfirmationContext";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SMS Payslip Manager",
  description: "Bulk payslip SMS notification system for HR teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ConfirmationProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ConfirmationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
