import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import rehypeSanitize from "rehype-sanitize"

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-reader">
      {/* sanitize d'abord (nettoie le HTML), puis slug ajoute les ancres — sinon sanitize retire les id */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeSlug]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
