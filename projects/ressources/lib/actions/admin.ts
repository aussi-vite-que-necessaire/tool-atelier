"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/guard"
import { moveInList } from "@/lib/admin/reorder"
import { validateModuleInput } from "@/lib/resources/module-input"
import * as service from "@/lib/resources/service"

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key)
  return v == null ? undefined : String(v)
}
function parsePath(s: string | undefined): string[] {
  return s ? s.split("/").filter(Boolean) : []
}
function revalidateResource(slug: string) {
  revalidatePath("/admin")
  revalidatePath(`/admin/r/${slug}`, "layout")
}

export async function createResourceAction(fd: FormData) {
  await requireAdmin()
  const title = str(fd, "title") ?? "Nouvelle ressource"
  const { slug } = await service.createResource({ title })
  redirect(`/admin/r/${slug}`)
}

export async function updateResourceMetaAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "slug")!
  await service.updateResource(slug, {
    title: str(fd, "title"),
    description: str(fd, "description"),
    coverImageUrl: str(fd, "coverImageUrl"),
    visibility: (str(fd, "visibility") as "public" | "private") ?? undefined,
    published: fd.get("published") === "on",
    featured: fd.get("featured") === "on",
  })
  revalidateResource(slug)
}

export async function deleteResourceAction(fd: FormData) {
  await requireAdmin()
  await service.deleteResource(str(fd, "slug")!)
  revalidatePath("/admin")
  redirect("/admin")
}

export async function addPageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.addPage({
    resourceSlug: slug,
    parentPath: parsePath(str(fd, "parentPath")),
    slug: str(fd, "slug") ?? "page",
    title: str(fd, "title") ?? "Page",
  })
  revalidateResource(slug)
}

export async function renamePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.updatePage({
    resourceSlug: slug,
    path: parsePath(str(fd, "path")),
    patch: { title: str(fd, "title"), slug: str(fd, "slug") || undefined },
  })
  revalidateResource(slug)
}

export async function deletePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.deletePage({ resourceSlug: slug, path: parsePath(str(fd, "path")) })
  revalidateResource(slug)
}

export async function movePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const ids = (str(fd, "orderedIds") ?? "").split(",").filter(Boolean)
  const reordered = moveInList(ids, str(fd, "id")!, str(fd, "direction") as "up" | "down")
  await service.reorderPages(reordered)
  revalidateResource(slug)
}

export async function addModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const m = validateModuleInput({ type: str(fd, "type"), content: JSON.parse(str(fd, "content") ?? "{}") })
  await service.addModule({ resourceSlug: slug, path: parsePath(str(fd, "path")), module: m })
  revalidateResource(slug)
}

export async function updateModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const m = validateModuleInput({ type: str(fd, "type"), content: JSON.parse(str(fd, "content") ?? "{}") })
  await service.updateModule({ id: str(fd, "id")!, content: m.content })
  revalidateResource(slug)
}

export async function deleteModuleAction(fd: FormData) {
  await requireAdmin()
  await service.deleteModule({ id: str(fd, "id")! })
  revalidateResource(str(fd, "resourceSlug")!)
}

export async function moveModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const ids = (str(fd, "orderedIds") ?? "").split(",").filter(Boolean)
  const reordered = moveInList(ids, str(fd, "id")!, str(fd, "direction") as "up" | "down")
  await service.reorderModules({ orderedModuleIds: reordered })
  revalidateResource(slug)
}

export async function grantAccessAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.grantAccess({ resourceSlug: slug, email: str(fd, "email")! })
  revalidateResource(slug)
}

export async function revokeAccessAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.revokeAccess({ resourceSlug: slug, email: str(fd, "email")! })
  revalidateResource(slug)
}
