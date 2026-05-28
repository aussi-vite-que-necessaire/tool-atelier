import { z } from "zod"
import { moduleContentSchemas } from "@/lib/modules/schemas"
import type { PageInput } from "./plan"

export const moduleInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), content: moduleContentSchemas.markdown }),
  z.object({ type: z.literal("callout"), content: moduleContentSchemas.callout }),
  z.object({ type: z.literal("image"), content: moduleContentSchemas.image }),
  z.object({ type: z.literal("video"), content: moduleContentSchemas.video }),
  z.object({ type: z.literal("file"), content: moduleContentSchemas.file }),
  z.object({ type: z.literal("embed"), content: moduleContentSchemas.embed }),
  z.object({ type: z.literal("code"), content: moduleContentSchemas.code }),
  z.object({ type: z.literal("prompt"), content: moduleContentSchemas.prompt }),
  z.object({ type: z.literal("accordion"), content: moduleContentSchemas.accordion }),
  z.object({ type: z.literal("steps"), content: moduleContentSchemas.steps }),
  z.object({ type: z.literal("comparison"), content: moduleContentSchemas.comparison }),
  z.object({ type: z.literal("quote"), content: moduleContentSchemas.quote }),
  z.object({ type: z.literal("cta"), content: moduleContentSchemas.cta }),
  z.object({ type: z.literal("gallery"), content: moduleContentSchemas.gallery }),
])

export type ModuleInput = z.infer<typeof moduleInputSchema>

export function validateModuleInput(raw: unknown): ModuleInput {
  return moduleInputSchema.parse(raw)
}

export const pageInputSchema: z.ZodType<PageInput> = z.lazy(() =>
  z.object({
    slug: z.string(),
    title: z.string(),
    modules: z.array(moduleInputSchema).optional().describe("Modules de la page, dans l'ordre."),
    children: z.array(pageInputSchema).optional().describe("Sous-pages imbriquées (récursif)."),
  }),
)
