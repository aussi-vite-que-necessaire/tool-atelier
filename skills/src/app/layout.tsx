import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skills",
  description: "Hub central des skills agentiques de la suite de tools de l'atelier (contentos, ressources, media).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
