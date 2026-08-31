import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ทีมโฟลว์ — Work Tracker",
  description: "ระบบจัดการงานทีมด้วย Supabase Authentication และฐานข้อมูลจริง"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
