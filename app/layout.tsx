import type { Metadata } from "next";
import { Lora, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppGradient } from "@/components/AppGradient";
import { SiteFooter } from "@/components/SiteFooter";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gridwork",
  description: "Design filet crochet patterns in your browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${nunito.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <AppGradient className="fixed inset-0 -z-10" />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
