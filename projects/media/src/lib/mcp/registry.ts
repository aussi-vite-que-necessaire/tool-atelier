import type { ToolDef } from "./types";
import { imageTools } from "./tools/images";
import { styleTools } from "./tools/styles";
import { styleGuideTools } from "./tools/style-guides";
import { brandTools } from "./tools/brand";
import { templateTools } from "./tools/templates";
import { pdfTools } from "./tools/pdf";

export const tools: ToolDef[] = [
  ...imageTools,
  ...styleTools,
  ...styleGuideTools,
  ...brandTools,
  ...templateTools,
  ...pdfTools,
];

export const toolsByName = new Map<string, ToolDef>(tools.map((t) => [t.name, t]));
