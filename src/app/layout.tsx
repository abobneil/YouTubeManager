import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const appSans = Roboto({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YouTube Smart Playlist Manager",
  description: "Manage YouTube topic playlists with keyword-driven sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={appSans.variable}>
        {children}
      </body>
    </html>
  );
}
