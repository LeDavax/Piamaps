import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Piana Care — Trouvez votre professionnel de santé",
  description:
    "Recherchez et localisez les professionnels de santé en France à partir des données officielles RPPS.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={archivo.variable}>
      <head>
        <link href="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.css" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Script src="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
