import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "auth",
  description: "Identity provider central de la suite contentos — SSO partagé entre media, cast, ressources… (BetterAuth, session cross-subdomain).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
