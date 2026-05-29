# Réorg admin média — galerie hub + modal de création unique — Plan d'implémentation

> **Exécution :** invoque `/lab-implémenter` pour exécuter ce plan tâche par tâche. Les steps utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Regrouper toutes les méthodes de création de média (upload, génération IA, composition PDF) derrière une porte unique — une modal near-fullscreen adressable par URL avec des onglets — et clarifier la navigation (Galerie en tête + section Bibliothèque), en supprimant la page `/pdf` de premier niveau. Pur travail d'organisation : aucune logique métier réécrite.

**Architecture:** Route group `(admin)` de Next 16 (App Router). La modal est une vraie route `gallery/new` (Server Component) rendue en overlay `fixed` (pas de parallel/intercepting routes). Les Server Actions existantes (`uploadAction`, `generateAction`, `composePdfAction`) sont réutilisées telles quelles ; on déplace des fichiers et on recâble l'UI.

**Tech Stack:** Next.js 16, React 19 (Server/Client Components, Server Actions), Tailwind 4, Vitest.

Spec de référence : `docs/superpowers/specs/2026-05-29-media-creation-modal-ia-design.md`.

> **Note (ambiguïté tranchée) :** l'onglet de l'upload reste ouvert après soumission (l'action `uploadAction` fait `revalidatePath("/gallery")` mais ne redirige pas) — comportement le plus simple, conforme à la spec (« la modal peut rester ouverte »). Aucune redirection ajoutée.
> **Contexte d'exécution :** worktree `/home/user/tool-atelier--media`, branche `work/media-creation-modal`, **commits non signés** (override `commit.gpgsign=false` worktree-scopé, contrainte d'infra cloud — la signature exige le checkout enregistré). Toutes les commandes `npm`/`git` se lancent depuis `projects/media/` dans ce worktree.

---

## Task 1 — Relocaliser la composition PDF sous `gallery/new/` et supprimer la page `/pdf`

Déplace les fichiers de composition PDF dans le futur dossier de la modal, recâble les imports, retire la route `/pdf` et son entrée de nav. Aucun rendu ne consomme encore le composer après cette tâche — c'est attendu.

- [ ] **Step 1.1 — Déplacer les trois fichiers du composer.**
  ```bash
  cd /home/user/tool-atelier--media/projects/media
  git mv "src/app/(admin)/pdf/order.ts"     "src/app/(admin)/gallery/new/order.ts"
  git mv "src/app/(admin)/pdf/actions.ts"   "src/app/(admin)/gallery/new/pdf-actions.ts"
  git mv "src/app/(admin)/pdf/composer.tsx" "src/app/(admin)/gallery/new/composer.tsx"
  ```

- [ ] **Step 1.2 — Recâbler l'import d'action dans `composer.tsx`.**
  Dans `src/app/(admin)/gallery/new/composer.tsx`, remplacer la ligne d'import des actions :
  ```ts
  import { composePdfAction, type ComposePdfResult } from "./actions";
  ```
  par :
  ```ts
  import { composePdfAction, type ComposePdfResult } from "./pdf-actions";
  ```
  (L'import `import { addImage, removeAt, moveUp, moveDown } from "./order";` reste inchangé.)

- [ ] **Step 1.3 — Repointer le test des helpers d'ordre.**
  Dans `test/pdf-order.test.ts`, remplacer :
  ```ts
  import { addImage, removeAt, moveUp, moveDown } from "@/app/(admin)/pdf/order";
  ```
  par :
  ```ts
  import { addImage, removeAt, moveUp, moveDown } from "@/app/(admin)/gallery/new/order";
  ```

- [ ] **Step 1.4 — Supprimer la page `/pdf`.**
  ```bash
  cd /home/user/tool-atelier--media/projects/media
  git rm "src/app/(admin)/pdf/page.tsx"
  ```
  (Le dossier `pdf/` est alors vide et disparaît.)

- [ ] **Step 1.5 — Retirer l'entrée de nav `PDF`.**
  Dans `src/app/(admin)/layout.tsx`, supprimer la ligne du tableau `navLinks` :
  ```ts
    { href: "/pdf", label: "PDF" },
  ```

- [ ] **Step 1.6 — Vérifier (test + typecheck).**
  ```bash
  cd /home/user/tool-atelier--media/projects/media
  npm test
  npm run build
  ```
  Attendu : `pdf-order.test.ts` passe au nouveau chemin ; build OK (le composer compile, simplement non rendu).

- [ ] **Step 1.7 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "♻️ media : relocalise la composition PDF sous gallery/new, retire la route /pdf"
  ```

---

## Task 2 — Helper pur de résolution d'onglet (`resolveTab`) + test (TDD)

L'onglet actif est porté par `?tab=` ; une valeur inconnue ou absente retombe sur `upload`. Logique pure → TDD.

- [ ] **Step 2.1 — Écrire le test (échoue).**
  Créer `test/gallery-tabs.test.ts` :
  ```ts
  import { describe, it, expect } from "vitest";
  import { resolveTab } from "@/app/(admin)/gallery/new/tabs";

  describe("resolveTab", () => {
    it("retourne l'onglet quand il est connu", () => {
      expect(resolveTab("upload")).toBe("upload");
      expect(resolveTab("generate")).toBe("generate");
      expect(resolveTab("pdf")).toBe("pdf");
    });
    it("retombe sur 'upload' pour une valeur inconnue", () => {
      expect(resolveTab("bogus")).toBe("upload");
    });
    it("retombe sur 'upload' quand absent", () => {
      expect(resolveTab(undefined)).toBe("upload");
    });
  });
  ```
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm test -- gallery-tabs
  ```
  Attendu : échec (module `tabs` introuvable).

- [ ] **Step 2.2 — Implémenter `tabs.ts` (passe).**
  Créer `src/app/(admin)/gallery/new/tabs.ts` :
  ```ts
  export const TABS = ["upload", "generate", "pdf"] as const;
  export type Tab = (typeof TABS)[number];

  // ?tab= inconnu ou absent → onglet par défaut.
  export function resolveTab(raw: string | undefined): Tab {
    return TABS.includes(raw as Tab) ? (raw as Tab) : "upload";
  }
  ```
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm test -- gallery-tabs
  ```
  Attendu : 3 tests verts.

- [ ] **Step 2.3 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "✅ media : helper resolveTab pour les onglets de la modal de création"
  ```

---

## Task 3 — Composant client `AddMediaDialog` (overlay near-fullscreen + onglets)

L'enveloppe visuelle de la modal : backdrop, panneau, barre d'onglets (liens `?tab=`), contenu de l'onglet actif. Réutilise le formulaire d'upload (déplacé ici), `GenerateForm` et `Composer`. Fermeture par croix, clic backdrop, `Échap`.

- [ ] **Step 3.1 — Créer `add-media-dialog.tsx`.**
  Créer `src/app/(admin)/gallery/new/add-media-dialog.tsx` :
  ```tsx
  "use client";

  import { useEffect } from "react";
  import Link from "next/link";
  import { useRouter } from "next/navigation";
  import { uploadAction } from "../actions";
  import { GenerateForm } from "../generate-form";
  import { Composer, type PickerImage } from "./composer";
  import { TABS, type Tab } from "./tabs";

  const TAB_LABELS: Record<Tab, string> = {
    upload: "Uploader un fichier",
    generate: "Générer une image (IA)",
    pdf: "Composer un PDF",
  };

  interface StyleOption {
    id: string;
    name: string;
  }

  export function AddMediaDialog({
    tab,
    styles,
    images,
  }: {
    tab: Tab;
    styles: StyleOption[];
    images: PickerImage[];
  }) {
    const router = useRouter();

    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") router.push("/gallery");
      }
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [router]);

    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        {/* Backdrop : ferme au clic */}
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => router.push("/gallery")}
          className="absolute inset-0 bg-black/40"
        />

        {/* Panneau near-fullscreen */}
        <div className="relative m-auto flex h-[92vh] w-[95vw] max-w-5xl flex-col rounded-lg bg-white shadow-xl">
          {/* En-tête : onglets + fermeture */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <Link
                  key={t}
                  href={`/gallery/new?tab=${t}`}
                  className={`rounded px-3 py-1.5 text-sm ${
                    t === tab
                      ? "bg-gray-800 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {TAB_LABELS[t]}
                </Link>
              ))}
            </div>
            <Link
              href="/gallery"
              aria-label="Fermer"
              className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </Link>
          </div>

          {/* Contenu de l'onglet actif */}
          <div className="flex-1 overflow-auto p-6">
            {tab === "upload" && (
              <form action={uploadAction} className="max-w-md space-y-3">
                <input
                  type="file"
                  name="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
                  required
                  className="block text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                />
                <p className="text-xs text-gray-400">
                  Types acceptés : PNG, JPEG, WebP (≤ 10 Mo), PDF (≤ 100 Mo), MP4 (≤ 100 Mo via l&apos;UI).
                  Pour les vidéos jusqu&apos;à 500 Mo, utiliser l&apos;API <code>/v1/upload</code>.
                </p>
                <button
                  type="submit"
                  className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                >
                  Uploader
                </button>
              </form>
            )}

            {tab === "generate" && <GenerateForm styles={styles} />}

            {tab === "pdf" && <Composer images={images} />}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3.2 — Vérifier le typecheck.**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm run build
  ```
  Attendu : build OK (le composant compile ; encore non routé).

- [ ] **Step 3.3 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "✨ media : composant AddMediaDialog (overlay + onglets de création)"
  ```

---

## Task 4 — Route serveur `gallery/new/page.tsx`

Le Server Component qui charge les données (styles + images sélectionnables pour le PDF), résout l'onglet et rend la modal.

- [ ] **Step 4.1 — Créer `page.tsx`.**
  Créer `src/app/(admin)/gallery/new/page.tsx` :
  ```tsx
  export const dynamic = "force-dynamic";

  import { listMediaRecords } from "@/lib/media/repository";
  import { listStyles } from "@/lib/styles/repository";
  import { requireUserId } from "@/lib/session";
  import { AddMediaDialog } from "./add-media-dialog";
  import type { PickerImage } from "./composer";
  import { resolveTab } from "./tabs";

  // Le composer PDF n'embarque que PNG et JPEG : ne proposer que ces formats.
  const PDF_MIMES = new Set(["image/png", "image/jpeg"]);

  export default async function NewMediaPage({
    searchParams,
  }: {
    searchParams: Promise<{ tab?: string }>;
  }) {
    const userId = await requireUserId();
    const { tab: tabParam } = await searchParams;
    const tab = resolveTab(tabParam);

    const [styles, images, renders] = await Promise.all([
      listStyles(userId),
      listMediaRecords(userId, { kind: "image", limit: 100 }),
      listMediaRecords(userId, { kind: "render", limit: 100 }),
    ]);

    const pickable: PickerImage[] = [...images, ...renders]
      .filter((m) => PDF_MIMES.has(m.mime))
      .sort((a, b) => b.created_at - a.created_at)
      .map((m) => ({ id: m.id, url: m.url }));

    return (
      <AddMediaDialog
        tab={tab}
        styles={styles.map((s) => ({ id: s.id, name: s.name }))}
        images={pickable}
      />
    );
  }
  ```

- [ ] **Step 4.2 — Vérifier (test + build).**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm test && npm run build
  ```
  Attendu : tout vert ; la route `/gallery/new` existe.

- [ ] **Step 4.3 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "✨ media : route /gallery/new rendant la modal de création"
  ```

---

## Task 5 — Galerie : bouton « Ajouter à la galerie », retrait des blocs upload/génération

La page galerie ne porte plus les formulaires en dur : juste l'en-tête (titre + bouton Ajouter), les filtres et la grille.

- [ ] **Step 5.1 — Réécrire `gallery/page.tsx`.**
  Remplacer intégralement `src/app/(admin)/gallery/page.tsx` par :
  ```tsx
  export const dynamic = "force-dynamic";

  import Link from "next/link";
  import { listMediaRecords } from "@/lib/media/repository";
  import type { MediaKind } from "@/lib/media/types";
  import { requireUserId } from "@/lib/session";
  import { GalleryGrid } from "./gallery-grid";

  const KINDS: MediaKind[] = ["image", "video", "pdf", "render"];

  export default async function GalleryPage({
    searchParams,
  }: {
    searchParams: Promise<{ kind?: string }>;
  }) {
    const userId = await requireUserId();
    const { kind: kindParam } = await searchParams;
    const kind: MediaKind | undefined = KINDS.includes(kindParam as MediaKind)
      ? (kindParam as MediaKind)
      : undefined;

    const items = await listMediaRecords(userId, { kind, limit: 100 });

    return (
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">
            Galerie{" "}
            <span className="text-sm font-normal text-gray-500">
              ({items.length} élément{items.length !== 1 ? "s" : ""})
            </span>
          </h1>
          <Link
            href="/gallery/new"
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            + Ajouter à la galerie
          </Link>
        </div>

        {/* Filtres par kind */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gallery"
            className={`rounded px-3 py-1 text-sm border ${
              !kind
                ? "bg-gray-800 text-white border-gray-800"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Tous
          </Link>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={`/gallery?kind=${k}`}
              className={`rounded px-3 py-1 text-sm border ${
                kind === k
                  ? "bg-gray-800 text-white border-gray-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {k}
            </Link>
          ))}
        </div>

        {/* Grille des médias */}
        <GalleryGrid items={items} />
      </div>
    );
  }
  ```
  Notes : les imports `uploadAction`, `GenerateForm` et `listStyles` ainsi que la `Promise.all` disparaissent (plus utilisés ici). `gallery-grid.tsx`, `generate-form.tsx` et `actions.ts` restent en place (toujours utilisés ailleurs).

- [ ] **Step 5.2 — Vérifier (build).**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm run build
  ```
  Attendu : build OK, aucun import inutilisé (eslint/tsc verts).

- [ ] **Step 5.3 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "♻️ media : galerie pilotée par un bouton « Ajouter à la galerie » (modal)"
  ```

---

## Task 6 — Navigation groupée en sections

La sidebar passe d'une liste plate à `Galerie` en tête + une section `Bibliothèque`.

- [ ] **Step 6.1 — Remplacer `navLinks` par `navSections` dans `layout.tsx`.**
  Dans `src/app/(admin)/layout.tsx`, remplacer la déclaration `navLinks` (déjà sans `PDF` depuis Task 1) par :
  ```tsx
  const navSections: {
    label: string | null;
    links: { href: string; label: string }[];
  }[] = [
    { label: null, links: [{ href: "/gallery", label: "Galerie" }] },
    {
      label: "Bibliothèque",
      links: [
        { href: "/templates", label: "Templates" },
        { href: "/styles", label: "Styles" },
        { href: "/style-guides", label: "Chartes" },
        { href: "/brand", label: "Marque" },
      ],
    },
  ];
  ```

- [ ] **Step 6.2 — Rendre les sections dans le `<nav>`.**
  Remplacer le bloc `<nav>…</nav>` du composant par :
  ```tsx
        <nav className="flex flex-col gap-4">
          {navSections.map((section, i) => (
            <div key={i} className="flex flex-col gap-1">
              {section.label && (
                <span className="px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {section.label}
                </span>
              )}
              {section.links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
  ```

- [ ] **Step 6.3 — Vérifier (build).**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm run build
  ```
  Attendu : build OK.

- [ ] **Step 6.4 — Commit.**
  ```bash
  cd /home/user/tool-atelier--media && git add -A && git commit -m "💄 media : navigation admin groupée (Galerie + Bibliothèque)"
  ```

---

## Task 7 — Vérification finale

- [ ] **Step 7.1 — Suite complète.**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && npm test && npm run build
  ```
  Attendu : tous les tests verts, build standalone OK.

- [ ] **Step 7.2 — Contrôle de cohérence (grep).**
  ```bash
  cd /home/user/tool-atelier--media/projects/media && ! grep -rn '"/pdf"\|(admin)/pdf' src test
  ```
  Attendu : aucune référence résiduelle à l'ancienne route `/pdf` (commande renvoie 0 si rien trouvé).

  Points à valider manuellement sur la preview (hors CI) : ouvrir la modal via « Ajouter à la galerie », parcourir les trois onglets (uploader / générer une image / composer un PDF), tester le deep-link `?tab=`, la fermeture (croix / backdrop / Échap), et vérifier que la nav groupée ne référence plus `/pdf`.
