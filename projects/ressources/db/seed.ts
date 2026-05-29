import { and, eq, inArray } from "drizzle-orm"
import { db } from "./index"
import { resources, pages, modules, resourceAccess, operators } from "./schema"
import { PREVIEW_USER_ID } from "../lib/auth/preview"

type Mod = { type: string; content: Record<string, unknown> }

// Opérateur de démo en preview : le preview-user (auto-loggé, operator par
// défaut) possède toutes les ressources seedées. Son espace : /o/demo.
const DEMO_OPERATOR = { id: PREVIEW_USER_ID, handle: "demo", name: "Démo Contentos" }

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

async function createResource(meta: {
  slug: string
  title: string
  description: string
  coverImageUrl?: string | null
  visibility?: "public" | "private"
  published?: boolean
  featured?: boolean
}) {
  await db
    .delete(resources)
    .where(and(eq(resources.operatorId, DEMO_OPERATOR.id), eq(resources.slug, meta.slug)))
  const [r] = await db
    .insert(resources)
    .values({
      operatorId: DEMO_OPERATOR.id,
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

async function seed() {
  // L'opérateur démo doit exister avant les ressources (FK operator_id).
  await db
    .insert(operators)
    .values(DEMO_OPERATOR)
    .onConflictDoUpdate({ target: operators.id, set: { handle: DEMO_OPERATOR.handle, name: DEMO_OPERATOR.name } })

  await db
    .delete(resources)
    .where(
      and(
        eq(resources.operatorId, DEMO_OPERATOR.id),
        inArray(resources.slug, [
          "showcase",
          "guide-ia",
          "atelier-prive",
          "automatiser-n8n",
          "deployer-coolify",
          "manifeste",
        ]),
      ),
    )

  // ───────────────────────── Showcase : tous les blocs ─────────────────────────
  const showcase = await createResource({
    slug: "showcase",
    title: "Le guide des composants",
    description: "Tous les types de blocs disponibles, illustrés un par un.",
    coverImageUrl: img("showcase-cover", 1200, 630),
    featured: true,
  })

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

  // — Page : blocs de texte —
  await addPage(showcase.id, scRoot.id, "blocs-texte", "Blocs de texte", 0, [
    {
      type: "markdown",
      content: {
        md: "## Markdown riche\n\nLe bloc **markdown** gère titres, listes, liens, `code inline`, citations et tableaux.\n\n### Une liste\n\n1. Premier point structurant\n2. Deuxième point, avec un [lien](https://avqn.ch)\n3. Troisième point\n\n> Une citation en markdown reste sobre et lisible.\n\n| Concept | Définition | Exemple |\n| --- | --- | --- |\n| LLM | Modèle de langage | GPT, Claude |\n| RAG | Génération augmentée | Recherche + LLM |\n| Agent | Boucle outillée | Claude Code |",
      },
    },
    {
      type: "callout",
      content: { variant: "success", md: "**Astuce.** Commence toujours par définir l'objectif avant d'écrire le prompt." },
    },
    {
      type: "callout",
      content: { variant: "warn", md: "**Attention.** Ne colle jamais de secret (clé API, token) dans un prompt partagé." },
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
    {
      type: "accordion",
      content: {
        title: "Pourquoi un accordéon ?",
        md: "Pour replier un détail optionnel sans alourdir la page. Idéal pour une FAQ ou une note avancée.",
        open: false,
      },
    },
    {
      type: "comparison",
      content: {
        columns: [
          { title: "Avant l'IA", md: "- Tâches manuelles\n- Copier-coller\n- Lent à itérer" },
          { title: "Avec un agent", md: "- Boucles automatisées\n- Contexte réutilisé\n- Itération rapide" },
        ],
      },
    },
  ])

  // — Page : blocs média —
  await addPage(showcase.id, scRoot.id, "blocs-media", "Blocs média", 1, [
    {
      type: "markdown",
      content: { md: "## Médias\n\nImage, galerie, vidéo, intégration et fichier téléchargeable." },
    },
    {
      type: "image",
      content: { url: img("schema-ia"), alt: "Schéma", caption: "Une image avec légende, encadrée." },
    },
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
    {
      type: "video",
      content: { url: "https://www.w3schools.com/html/mov_bbb.mp4", caption: "Une vidéo auto-hébergée." },
    },
    {
      type: "embed",
      content: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    },
    {
      type: "file",
      content: { url: "https://example.com/workflow.json", label: "Workflow n8n prêt à importer", filename: "workflow.json", size: 20480 },
    },
  ])

  // — Page : blocs riches —
  await addPage(showcase.id, scRoot.id, "blocs-riches", "Blocs riches", 2, [
    {
      type: "markdown",
      content: { md: "## Code & prompts\n\nDes blocs pensés pour les développeurs et les prompteurs." },
    },
    {
      type: "code",
      content: {
        language: "typescript",
        filename: "agent.ts",
        code: "import { runAgent } from \"./core\"\n\nexport async function main() {\n  const result = await runAgent({\n    goal: \"Résumer le rapport trimestriel\",\n    tools: [\"search\", \"read\", \"write\"],\n  })\n  console.log(result.summary)\n}",
      },
    },
    {
      type: "code",
      content: {
        language: "bash",
        code: "# Déployer en une commande\nnpm run build && npm run deploy --env=prod",
      },
    },
    {
      type: "prompt",
      content: {
        title: "Prompt — synthèse d'article",
        prompt: "Tu es un éditeur exigeant. Résume l'article ci-dessous en 5 points clés, puis propose un titre accrocheur de moins de 60 caractères.\n\nArticle :\n\"\"\"\n{{texte}}\n\"\"\"",
      },
    },
    {
      type: "cta",
      content: { label: "Réserver un appel", url: "https://avqn.ch", variant: "primary" },
    },
    {
      type: "cta",
      content: { label: "Voir la documentation", url: "https://avqn.ch", variant: "secondary" },
    },
  ])

  // ───────────────────────── Guide IA (2e ressource featured) ─────────────────────────
  const guide = await createResource({
    slug: "guide-ia",
    title: "Guide IA appliquée",
    description: "Comprendre les modèles, écrire de bons prompts, automatiser.",
    coverImageUrl: img("guide-ia-cover", 1200, 630),
    featured: true,
  })
  const gRoot = await addPage(guide.id, null, "", "Introduction", 0, [
    {
      type: "markdown",
      content: {
        md: "## Contexte\n\nCe guide approfondit les bases de l'IA appliquée au quotidien.\n\n## Objectifs\n\n- Comprendre les modèles de langage\n- Écrire des prompts spécifiques et contextualisés\n- Automatiser des tâches répétitives",
      },
    },
    {
      type: "callout",
      content: { variant: "success", md: "Définis clairement ton objectif **avant** de prompter." },
    },
  ])
  await addPage(guide.id, gRoot.id, "prompting", "Prompting", 0, [
    {
      type: "markdown",
      content: { md: "## Prompting\n\nUn bon prompt est **spécifique**, **contextualisé** et **vérifiable**." },
    },
    {
      type: "prompt",
      content: { prompt: "Agis comme un expert. Donne-moi 3 angles d'attaque pour : {{sujet}}." },
    },
  ])
  await addPage(guide.id, gRoot.id, "automatisation", "Automatisation", 1, [
    { type: "markdown", content: { md: "## Automatisation\n\nRelie tes outils et laisse l'agent faire le travail répétitif." } },
  ])
  // Fixture mise en page : page SANS titre de section dans une ressource
  // multi-pages → colonne de gauche affichée, colonne de droite masquée.
  await addPage(guide.id, gRoot.id, "pour-aller-plus-loin", "Pour aller plus loin", 2, [
    {
      type: "markdown",
      content: {
        md: "Tu as parcouru l'essentiel. La suite se joue dans la pratique : choisis une tâche réelle, écris le prompt, mesure le résultat, recommence. C'est en itérant que les automatisations deviennent fiables.",
      },
    },
    { type: "cta", content: { label: "Réserver un appel", url: "https://avqn.ch", variant: "primary" } },
  ])

  // ───────────────────────── Deux ressources pour garnir la grille ─────────────────────────
  const n8n = await createResource({
    slug: "automatiser-n8n",
    title: "Automatiser avec n8n",
    description: "Des workflows no-code pour connecter tes outils.",
    coverImageUrl: img("n8n-cover", 1200, 630),
    featured: true,
  })
  await addPage(n8n.id, null, "", "Démarrer", 0, [
    { type: "markdown", content: { md: "## n8n\n\nUn orchestrateur visuel pour automatiser sans coder." } },
  ])

  const coolify = await createResource({
    slug: "deployer-coolify",
    title: "Déployer avec Coolify",
    description: "Héberger ses apps sur son propre serveur, sereinement.",
    featured: true,
  })
  await addPage(coolify.id, null, "", "Mise en route", 0, [
    { type: "markdown", content: { md: "## Coolify\n\nUn PaaS auto-hébergé, alternative simple à Vercel." } },
  ])

  // ───────── Fixture mise en page : page unique SANS titre de section ─────────
  // Une seule page + aucun titre → les deux rails sont masqués et le contenu
  // passe en largeur de lecture centrée (« mode article »).
  const manifeste = await createResource({
    slug: "manifeste",
    title: "Manifeste",
    description: "Une page unique, sans sommaire : juste le texte.",
    coverImageUrl: img("manifeste-cover", 1200, 630),
    featured: false,
  })
  await addPage(manifeste.id, null, "", "Manifeste", 0, [
    {
      type: "markdown",
      content: {
        md: "Construire vite ne veut pas dire construire à la légère. Chaque outil qu'on s'épargne d'écrire est du temps rendu à ce qui compte vraiment : comprendre le problème, soigner la finition, livrer.\n\nUne ressource n'a pas toujours besoin d'un sommaire ni d'une arborescence. Parfois, une seule page qui se lit d'une traite suffit — et c'est exactement ce que cette mise en page veut servir : du texte, centré, sans distraction.",
      },
    },
    {
      type: "quote",
      content: { text: "Aussi vite que nécessaire, pas plus.", author: "AVQN", url: "https://avqn.ch" },
    },
    { type: "cta", content: { label: "Découvrir la bibliothèque", url: "/bibliotheque", variant: "primary" } },
  ])

  // ───────────────────────── Ressource privée (gate) ─────────────────────────
  const priv = await createResource({
    slug: "atelier-prive",
    title: "Atelier privé",
    description: "Ressource réservée aux participants de l'atelier.",
    coverImageUrl: img("atelier-cover", 1200, 630),
    visibility: "private",
    featured: false,
  })
  await addPage(priv.id, null, "", "Brief client", 0, [
    { type: "markdown", content: { md: "## Brief\n\nContenu réservé au client." } },
  ])
  await db.insert(resourceAccess).values({ resourceId: priv.id, email: "client@exemple.com" })

  console.log("Seed OK :")
  console.log("  public  → /r/showcase  /r/guide-ia  /r/automatiser-n8n  /r/deployer-coolify  /r/manifeste")
  console.log("  privé   → /r/atelier-prive (client@exemple.com)")
  console.log("  mise en page :")
  console.log("    2 rails  → /r/showcase")
  console.log("    gauche   → /r/guide-ia/pour-aller-plus-loin")
  console.log("    droite   → /r/automatiser-n8n")
  console.log("    aucun    → /r/manifeste")
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
