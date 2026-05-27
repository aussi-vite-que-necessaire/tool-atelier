import Link from "next/link";
import { requireSession } from "@/lib/auth-guard";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/gallery", label: "Galerie" },
  { href: "/templates", label: "Templates" },
  { href: "/styles", label: "Styles" },
  { href: "/style-guides", label: "Chartes" },
  { href: "/brand", label: "Marque" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="flex min-h-screen">
      <aside className="w-48 shrink-0 border-r border-gray-200 flex flex-col gap-6 p-4">
        <span className="font-semibold text-sm tracking-wide">media</span>
        <nav className="flex flex-col gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
