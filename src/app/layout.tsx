import type { Metadata } from "next";
import { JetBrains_Mono, Roboto } from "next/font/google";
import "./globals.css";

const appSans = Roboto({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const appMono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
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
      <body className={`${appSans.variable} ${appMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
