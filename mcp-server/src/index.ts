#!/usr/bin/env node
/**
 * Entry point: load the content bundle once (see content.ts's stdio-purity note — nothing here
 * may touch stdout except the MCP transport itself), register the quiz tools, and serve over
 * stdio. Intended to be spawned directly by a local MCP host (Claude Desktop, Claude Code, or a
 * custom local agent) — see README.md for registration instructions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundle } from "./content.js";
import { registerTools } from "./tools.js";

async function main(): Promise<void> {
  const bundle = loadBundle();

  const server = new McpServer({ name: "snowprep-quiz", version: "0.1.0" });
  registerTools(server, bundle);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✓ snowprep-quiz MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server crashed:", err);
  process.exit(1);
});
