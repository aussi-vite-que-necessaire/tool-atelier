import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const url = process.env.MCP_URL ?? "http://localhost:3001/api/mcp"
const key = process.env.ADMIN_API_KEY ?? ""

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map((c) => c.text ?? "").join("")
}

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  })
  const client = new Client({ name: "smoke", version: "1.0.0" })
  await client.connect(transport)

  const tools = await client.listTools()
  console.log("OUTILS:", tools.tools.map((t) => t.name).join(", "))

  const call = async (name: string, args: Record<string, unknown>) => {
    const res = (await client.callTool({ name, arguments: args })) as {
      content: Array<{ type: string; text?: string }>
      isError?: boolean
    }
    const text = textOf(res)
    if (res.isError) throw new Error(`${name} a échoué: ${text}`)
    return text
  }

  // 1. Création bulk (privée, pour tester aussi grant_access)
  const created = JSON.parse(
    await call("create_resource", {
      title: "Smoke MCP",
      visibility: "private",
      published: true,
      rootTitle: "Intro",
      rootModules: [{ type: "markdown", content: { md: "## Salut\n\nTest." } }],
      pages: [{ slug: "details", title: "Détails", modules: [{ type: "callout", content: { variant: "info", md: "Note" } }] }],
    }),
  )
  console.log("CREATE:", created.url)
  const slug = created.slug as string

  // 2. Édition fine : ajouter un module, le réordonner, mettre en avant
  const added = JSON.parse(await call("add_module", { resourceSlug: slug, path: [], module: { type: "embed", content: { url: "https://www.youtube.com/embed/x" } } }))
  console.log("ADD_MODULE id:", added.id)
  await call("update_resource", { slug, patch: { featured: true, description: "MAJ" } })

  // 3. Accès privé
  await call("grant_access", { resourceSlug: slug, email: "smoke@exemple.com" })
  console.log("GRANT_ACCESS ok")

  // 4. Relire pour confirmer la structure
  const got = JSON.parse(await call("get_resource", { slug }))
  console.log("GET root modules:", got.root.modules.length, "| children:", got.root.children.length)

  // 5. Réordonner les modules de la racine
  const ids = got.root.modules.map((m: { id: string }) => m.id).reverse()
  await call("reorder_modules", { orderedModuleIds: ids })
  console.log("REORDER ok")

  // 6. Nettoyage
  await call("delete_resource", { slug })
  console.log("DELETE ok (auto-nettoyage)")

  await client.close()
  process.exit(0)
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e)
  process.exit(1)
})
