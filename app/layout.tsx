import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PosthogProvider } from "../components/PosthogProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title:
    "CycloneWatch: Live Tropical Cyclone Risk Alerts for Shipping, Insurance, and Coastal Communities",
  description:
    "CycloneWatch turns official hurricane forecasts into transparent 0-100 risk scores for ports, vessels, and coastal facilities. Live NHC storm tracks, forecast cones, wind extents, hyperlocal alerts, and a free JSON API. Open source.",
  keywords: [
    "tropical cyclone alerts",
    "hurricane tracker",
    "typhoon risk",
    "storm surge",
    "shipping risk",
    "parametric insurance",
    "hurricane forecast cone",
    "port risk",
    "NHC",
  ],
  authors: [{ name: "CycloneWatch" }],
  metadataBase: new URL("https://cyclonewatch.nshipyard.com"),
  openGraph: {
    title: "CycloneWatch: Live Tropical Cyclone Risk Alerts",
    description:
      "Transparent 0-100 cyclone risk scores for 38 world ports, live NHC tracks, and a free JSON API. Open source, MIT licensed.",
    type: "website",
    url: "https://cyclonewatch.nshipyard.com",
    images: [
      {
        url: "https://cyclonewatch.nshipyard.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "CycloneWatch: Live Tropical Cyclone Risk Alerts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CycloneWatch: Live Tropical Cyclone Risk Alerts",
    description:
      "Transparent 0-100 cyclone risk scores for ports and coastal assets, live NHC data, free API.",
    images: ["https://cyclonewatch.nshipyard.com/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-neutral-900"><PosthogProvider>
        {children}
      </PosthogProvider></body>
    </html>
  );
}
