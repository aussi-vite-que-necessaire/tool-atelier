import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPing } from "./tools/ping";

// INSTRUCTIONS : décrit le serveur pour l'agent IA. Réécrit par /lab-new selon le projet.
export const INSTRUCTIONS = "Serveur MCP du projet. Décris ici ce qu'il permet de faire.";

export function registerAllTools(server: McpServer): void {
  registerPing(server);
}
