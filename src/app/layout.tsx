import type { Metadata } from "next";
import { Space_Grotesk, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const appSans = Space_Grotesk({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appMono = Source_Code_Pro({
  variable: "--font-app-mono",
  subsets: ["latin"],
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
