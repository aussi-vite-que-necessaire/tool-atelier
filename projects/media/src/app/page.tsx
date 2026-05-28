import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await getUserId();
  if (userId) redirect("/gallery");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">media — centre des médias</h1>
      <Link href="/sign-in" className="text-sm underline">
        Se connecter
      </Link>
    </main>
  );
}
