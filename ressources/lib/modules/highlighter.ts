import { codeToHtml } from "shiki"

export async function highlight(code: string, language: string): Promise<string> {
  try {
    return await codeToHtml(code, { lang: language, theme: "github-light" })
  } catch {
    return await codeToHtml(code, { lang: "text", theme: "github-light" })
  }
}
