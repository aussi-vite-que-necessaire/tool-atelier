import type { ParsedModule } from "@/lib/modules/schemas"
import { MarkdownModule } from "./markdown-module"
import { CalloutModule } from "./callout-module"
import { ImageModule } from "./image-module"
import { VideoModule } from "./video-module"
import { FileModule } from "./file-module"
import { EmbedModule } from "./embed-module"
import { CodeModule } from "./code-module"
import { PromptModule } from "./prompt-module"
import { AccordionModule } from "./accordion-module"
import { StepsModule } from "./steps-module"
import { ComparisonModule } from "./comparison-module"
import { QuoteModule } from "./quote-module"
import { CtaModule } from "./cta-module"
import { GalleryModule } from "./gallery-module"

export function ModuleView({ module }: { module: ParsedModule }) {
  switch (module.type) {
    case "markdown":
      return <MarkdownModule {...module.content} />
    case "callout":
      return <CalloutModule {...module.content} />
    case "image":
      return <ImageModule {...module.content} />
    case "video":
      return <VideoModule {...module.content} />
    case "file":
      return <FileModule {...module.content} />
    case "embed":
      return <EmbedModule {...module.content} />
    case "code":
      return <CodeModule {...module.content} />
    case "prompt":
      return <PromptModule {...module.content} />
    case "accordion":
      return <AccordionModule {...module.content} />
    case "steps":
      return <StepsModule {...module.content} />
    case "comparison":
      return <ComparisonModule {...module.content} />
    case "quote":
      return <QuoteModule {...module.content} />
    case "cta":
      return <CtaModule {...module.content} />
    case "gallery":
      return <GalleryModule {...module.content} />
  }
}
