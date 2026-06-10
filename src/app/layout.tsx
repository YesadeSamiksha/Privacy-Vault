import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivacyVault",
  description: "DPDP Act 2023 Compliance Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
