/**
 * Issue-to-PR Agent
 *
 * An autonomous AI agent that takes GitHub issues and implements solutions
 * by creating pull requests.
 *
 * Usage:
 *   deno run -A main.ts
 */

import "@std/dotenv/load";
import {
  ZypherAgent,
  AnthropicModelProvider,
  runAgentInTerminal,
  createZypherContext,
} from "@corespeed/zypher";

import {
  ReadFileTool,
  ListDirTool,
  GrepSearchTool,
  RunTerminalCmdTool,
  createEditFileTools,
} from "@corespeed/zypher/tools";

import { githubTools } from "./tools/github.ts";
import { gitTools } from "./tools/git.ts";

// Load system prompt
const systemPrompt = await Deno.readTextFile(
  new URL("./prompts/system.md", import.meta.url)
);

// Validate environment
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
const githubToken = Deno.env.get("GITHUB_TOKEN");

if (!anthropicKey) {
  console.error("❌ Error: ANTHROPIC_API_KEY environment variable is required");
  console.error("   Create a .env file with your API key (see .env.example)");
  Deno.exit(1);
}

if (!githubToken) {
  console.error("❌ Error: GITHUB_TOKEN environment variable is required");
  console.error("   Create a .env file with your GitHub token (see .env.example)");
  Deno.exit(1);
}

// Create Zypher context
const context = await createZypherContext(Deno.cwd());

// Initialize the agent
const agent = new ZypherAgent(
  context,
  new AnthropicModelProvider({
    apiKey: anthropicKey,
  }),
  {
    overrides: {
      systemPromptLoader: async () => systemPrompt,
    },
  }
);

// Register built-in file tools
const { EditFileTool, UndoFileTool } = createEditFileTools();
const builtInTools = [
  ReadFileTool,
  ListDirTool,
  GrepSearchTool,
  RunTerminalCmdTool,
  EditFileTool,
  UndoFileTool,
];

for (const tool of builtInTools) {
  agent.mcp.registerTool(tool);
}

// Register custom GitHub and git tools
const customTools = [...githubTools, ...gitTools];
for (const tool of customTools) {
  agent.mcp.registerTool(tool);
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  Issue-to-PR Agent                        ║
║         Autonomous GitHub Issue Implementation            ║
╚═══════════════════════════════════════════════════════════╝
`);

const allToolNames = [...builtInTools, ...customTools].map((t) => t.name);
console.log("🔧 Registered tools:", allToolNames.join(", "));
console.log("");
console.log("💡 Example tasks:");
console.log("   - Implement https://github.com/owner/repo/issues/123");
console.log("   - Fix the bug described in owner/repo#45");
console.log("");
console.log("🚀 Starting interactive mode...");
console.log("");

// Run the agent in interactive mode
await runAgentInTerminal(agent, "claude-sonnet-4-20250514");
