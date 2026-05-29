import { and, eq, inArray } from "drizzle-orm"
import { db } from "./index"
import {
  resources,
  pages,
  modules,
  resourceAccess,
  operators,
  audienceMembers,
  subscriptions,
} from "./schema"
import { PREVIEW_OP_1_ID, PREVIEW_OP_2_ID, PREVIEW_AUD_3_ID } from "../lib/auth/preview"

// Seed preview uniquement (jamais prod). Deux opérateurs (user1/user2) avec
// chacun SES ressources (test d'isolation), + un abonné audience (user3) inscrit
// au contenu des deux. Les ids correspondent aux users seedés côté auth.

type Mod = { type: string; content: Record<string, unknown> }
type ResourceRow = typeof resources.$inferSelect

async function addPage(
  resourceId: string,
  parentId: string | null,
  slug: string,
  title: string,
  position: number,
  mods: Mod[],
) {
  const [page] = await db
    .insert(pages)
    .values({ resourceId, parentId, slug, title, position })
    .returning()
  if (mods.length) {
    await db.insert(modules).values(
      mods.map((m, i) => ({ pageId: page.id, type: m.type, position: i, content: m.content })),
    )
  }
  return page
}

async function createResource(
  operatorId: string,
  meta: {
    slug: string
    title: string
    description: string
    coverImageUrl?: string | null
    visibility?: "public" | "private"
    published?: boolean
    featured?: boolean
  },
): Promise<ResourceRow> {
  await db
    .delete(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.slug, meta.slug)))
  const [r] = await db
    .insert(resources)
    .values({
      operatorId,
      slug: meta.slug,
      title: meta.title,
      description: meta.description,
      coverImageUrl: meta.coverImageUrl ?? null,
      visibility: meta.visibility ?? "public",
      published: meta.published ?? true,
      featured: meta.featured ?? false,
    })
    .returning()
  return r
}

const img = (seed: string, w = 1200, h = 700) => `https://picsum.photos/seed/${seed}/${w}/${h}`

// ───────── Opérateur 1 (user1) : catalogue complet (showcase des blocs) ─────────
async function seedOperator1(operatorId: string): Promise<ResourceRow[]> {
  const created: ResourceRow[] = []

  const showcase = await createResource(operatorId, {
    slug: "showcase",
    title: "Le guide des composants",
    description: "Tous les types de blocs disponibles, illustrés un par un.",
    coverImageUrl: img("showcase-cover", 1200, 630),
    featured: true,
  })
  created.push(showcase)

  const scRoot = await addPage(showcase.id, null, "", "Introduction", 0, [
    {
      type: "markdown",
      content: {
        md: "## Bienvenue\n\nCe guide montre **chaque type de bloc** que tu peux assembler dans une ressource. Parcours les sections dans la barre latérale : texte, médias, puis blocs riches.\n\n- Chaque page isole une famille de blocs\n- Le rendu est identique côté lecteur et côté aperçu\n- Tout se pilote depuis un agent IA via MCP",
      },
    },
    {
      type: "callout",
      content: {
        variant: "info",
        md: "**À quoi sert ce document ?** Te donner un aperçu vivant de la bibliothèque de composants, et servir de terrain de test visuel.",
      },
    },
    {
      type: "steps",
      content: {
        steps: [
          { title: "Choisis une famille", md: "Texte, médias ou blocs riches dans la navigation." },
          { title: "Observe le rendu", md: "Chaque bloc est présenté avec un exemple réaliste." },
          { title: "Reproduis-le", md: "Demande à ton agent d'ajouter le même bloc à ta ressource." },
        ],
      },
    },
  ])

  await addPage(showcase.id, scRoot.id, "blocs-texte", "Blocs de texte", 0, [
    {
      type: "markdown",
      content: {
        md: "## Markdown riche\n\nLe bloc **markdown** gère titres, listes, liens, `code inline`, citations et tableaux.\n\n### Une liste\n\n1. Premier point structurant\n2. Deuxième point, avec un [lien](https://avqn.ch)\n3. Troisième point\n\n> Une citation en markdown reste sobre et lisible.",
      },
    },
    {
      type: "callout",
      content: { variant: "success", md: "**Astuce.** Commence toujours par définir l'objectif avant d'écrire le prompt." },
    },
    {
      type: "quote",
      content: {
        text: "Le meilleur outil est celui qu'on prend le temps de bien nommer.",
        author: "Emmanuel Bernard",
        source: "AVQN",
        url: "https://avqn.ch",
      },
    },
  ])

  await addPage(showcase.id, scRoot.id, "blocs-media", "Blocs média", 1, [
    { type: "markdown", content: { md: "## Médias\n\nImage, galerie, vidéo, intégration et fichier téléchargeable." } },
    { type: "image", content: { url: img("schema-ia"), alt: "Schéma", caption: "Une image avec légende, encadrée." } },
    {
      type: "gallery",
      content: {
        images: [
          { url: img("gal-1", 800, 600), caption: "Étape 1" },
          { url: img("gal-2", 800, 600), caption: "Étape 2" },
          { url: img("gal-3", 800, 600), caption: "Étape 3" },
        ],
      },
    },
  ])

  await addPage(showcase.id, scRoot.id, "blocs-riches", "Blocs riches", 2, [
    { type: "markdown", content: { md: "## Code & prompts\n\nDes blocs pensés pour les développeurs et les prompteurs." } },
    {
      type: "code",
      content: {
        language: "typescript",
        filename: "agent.ts",
        code: 'import { runAgent } from "./core"\n\nexport async function main() {\n  const result = await runAgent({ goal: "Résumer le rapport" })\n  console.log(result.summary)\n}',
      },
    },
    {
      type: "prompt",
      content: {
        title: "Prompt — synthèse d'article",
        prompt: "Tu es un éditeur exigeant. Résume l'article en 5 points clés, puis propose un titre de moins de 60 caractères.",
      },
    },
    { type: "cta", content: { label: "Réserver un appel", url: "https://avqn.ch", variant: "primary" } },
  ])

  const guide = await createResource(operatorId, {
    slug: "guide-ia",
    title: "Guide IA appliquée",
    description: "Comprendre les modèles, écrire de bons prompts, automatiser.",
    coverImageUrl: img("guide-ia-cover", 1200, 630),
    featured: true,
  })
  created.push(guide)
  const gRoot = await addPage(guide.id, null, "", "Introduction", 0, [
    {
      type: "markdown",
      content: {
        md: "## Contexte\n\nCe guide approfondit les bases de l'IA appliquée au quotidien.\n\n## Objectifs\n\n- Comprendre les modèles de langage\n- Écrire des prompts spécifiques\n- Automatiser des tâches répétitives",
      },
    },
  ])
  await addPage(guide.id, gRoot.id, "prompting", "Prompting", 0, [
    { type: "markdown", content: { md: "## Prompting\n\nUn bon prompt est **spécifique**, **contextualisé** et **vérifiable**." } },
    { type: "prompt", content: { prompt: "Agis comme un expert. Donne-moi 3 angles d'attaque pour : {{sujet}}." } },
  ])

  const manifeste = await createResource(operatorId, {
    slug: "manifeste",
    title: "Manifeste",
    description: "Une page unique, sans sommaire : juste le texte.",
    coverImageUrl: img("manifeste-cover", 1200, 630),
    featured: false,
  })
  created.push(manifeste)
  await addPage(manifeste.id, null, "", "Manifeste", 0, [
    {
      type: "markdown",
      content: {
        md: "Construire vite ne veut pas dire construire à la légère. Chaque outil qu'on s'épargne d'écrire est du temps rendu à ce qui compte vraiment : comprendre le problème, soigner la finition, livrer.",
      },
    },
    { type: "quote", content: { text: "Aussi vite que nécessaire, pas plus.", author: "AVQN", url: "https://avqn.ch" } },
  ])

  // Ressource privée (gate) — accès accordé par email plus bas (audience user3).
  const priv = await createResource(operatorId, {
    slug: "atelier-prive",
    title: "Atelier privé",
    description: "Ressource réservée aux participants de l'atelier.",
    coverImageUrl: img("atelier-cover", 1200, 630),
    visibility: "private",
    featured: false,
  })
  created.push(priv)
  await addPage(priv.id, null, "", "Brief client", 0, [
    { type: "markdown", content: { md: "## Brief\n\nContenu réservé aux participants." } },
  ])

  return created
}

// ───────── Opérateur 2 (user2) : catalogue distinct (test d'isolation) ─────────
async function seedOperator2(operatorId: string): Promise<ResourceRow[]> {
  const created: ResourceRow[] = []

  const atelier = await createResource(operatorId, {
    slug: "atelier-no-code",
    title: "Atelier no-code",
    description: "Monter ses automatisations sans écrire de code.",
    coverImageUrl: img("op2-atelier-cover", 1200, 630),
    featured: true,
  })
  created.push(atelier)
  const aRoot = await addPage(atelier.id, null, "", "Bienvenue", 0, [
    { type: "markdown", content: { md: "## Atelier no-code de user2\n\nUn parcours pour relier ses outils sans coder." } },
    { type: "callout", content: { variant: "info", md: "Ce contenu appartient à **user2** — il ne doit jamais apparaître chez user1." } },
  ])
  await addPage(atelier.id, aRoot.id, "outils", "Les outils", 0, [
    { type: "markdown", content: { md: "## Outils\n\nn8n, Zapier, Make : choisir selon le besoin." } },
  ])

  const gratuites = await createResource(operatorId, {
    slug: "ressources-gratuites",
    title: "Ressources gratuites",
    description: "Une sélection de templates et checklists offerts.",
    coverImageUrl: img("op2-gratuites-cover", 1200, 630),
    featured: true,
  })
  created.push(gratuites)
  await addPage(gratuites.id, null, "", "À télécharger", 0, [
    { type: "markdown", content: { md: "## Gratuit\n\nTemplates Notion, checklists, prompts prêts à l'emploi." } },
    { type: "cta", content: { label: "Tout récupérer", url: "https://avqn.ch", variant: "primary" } },
  ])

  const coaching = await createResource(operatorId, {
    slug: "coaching-prive",
    title: "Coaching privé",
    description: "Espace réservé aux clients du coaching de user2.",
    coverImageUrl: img("op2-coaching-cover", 1200, 630),
    visibility: "private",
    featured: false,
  })
  created.push(coaching)
  await addPage(coaching.id, null, "", "Programme", 0, [
    { type: "markdown", content: { md: "## Programme\n\nContenu réservé aux clients de user2." } },
  ])

  return created
}

async function seed() {
  if (process.env.APP_ENV === "prod") {
    console.log("seed: APP_ENV=prod → pas de données de démo (refusé).")
    process.exit(0)
  }

  // Les opérateurs doivent exister avant leurs ressources (FK operator_id).
  const OPS = [
    { id: PREVIEW_OP_1_ID, handle: "user1", name: "User 1 (preview)" },
    { id: PREVIEW_OP_2_ID, handle: "user2", name: "User 2 (preview)" },
  ]
  for (const op of OPS) {
    await db
      .insert(operators)
      .values(op)
      .onConflictDoUpdate({ target: operators.id, set: { handle: op.handle, name: op.name } })
  }

  // Nettoyage des ressources seedées (idempotence) pour chaque opérateur.
  await db
    .delete(resources)
    .where(
      and(
        eq(resources.operatorId, PREVIEW_OP_1_ID),
        inArray(resources.slug, ["showcase", "guide-ia", "manifeste", "atelier-prive"]),
      ),
    )
  await db
    .delete(resources)
    .where(
      and(
        eq(resources.operatorId, PREVIEW_OP_2_ID),
        inArray(resources.slug, ["atelier-no-code", "ressources-gratuites", "coaching-prive"]),
      ),
    )

  const op1Resources = await seedOperator1(PREVIEW_OP_1_ID)
  const op2Resources = await seedOperator2(PREVIEW_OP_2_ID)

  // ───────── Audience : user3 abonné aux deux opérateurs ─────────
  for (const opId of [PREVIEW_OP_1_ID, PREVIEW_OP_2_ID]) {
    await db
      .insert(audienceMembers)
      .values({ operatorId: opId, userId: PREVIEW_AUD_3_ID })
      .onConflictDoNothing()
  }

  // Abonnements à quelques ressources publiques des deux opérateurs.
  const subscribable = [
    op1Resources.find((r) => r.slug === "showcase"),
    op1Resources.find((r) => r.slug === "guide-ia"),
    op2Resources.find((r) => r.slug === "atelier-no-code"),
    op2Resources.find((r) => r.slug === "ressources-gratuites"),
  ].filter((r): r is ResourceRow => !!r)
  for (const r of subscribable) {
    await db
      .insert(subscriptions)
      .values({ userId: PREVIEW_AUD_3_ID, resourceId: r.id })
      .onConflictDoNothing()
  }

  // Accès par email à une ressource privée d'op1 (test du gate par email).
  const priv = op1Resources.find((r) => r.slug === "atelier-prive")
  if (priv) {
    await db
      .insert(resourceAccess)
      .values({ resourceId: priv.id, email: "user3@avqn.ch" })
      .onConflictDoNothing()
  }

  console.log("Seed OK (preview) :")
  console.log(`  user1 → /o/user1 : ${op1Resources.map((r) => r.slug).join(", ")}`)
  console.log(`  user2 → /o/user2 : ${op2Resources.map((r) => r.slug).join(", ")}`)
  console.log(`  user3 (audience) → abonné à ${subscribable.length} ressources + accès atelier-prive`)
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
