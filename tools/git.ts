/**
 * Git operation tools for branching, committing, and pushing
 */

import { createTool } from "@corespeed/zypher/tools";
import { z } from "npm:zod";

/**
 * Execute a command and return the result
 */
async function runCommand(cmd: string[], cwd?: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const command = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      cwd,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    return {
      success: code === 0,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: String(error),
    };
  }
}

/**
 * Tool to get current git status
 */
export const gitStatusTool = createTool({
  name: "git_status",
  description: "Get the current git status including branch name, staged/unstaged changes.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
  }),
  execute: async (_params, ctx) => {
    const cwd = ctx.workingDirectory;

    const [statusResult, branchResult] = await Promise.all([
      runCommand(["git", "status", "--porcelain"], cwd),
      runCommand(["git", "branch", "--show-current"], cwd),
    ]);

    if (!statusResult.success) {
      return `Error: ${statusResult.stderr}`;
    }

    const branch = branchResult.stdout.trim();
    const changes = statusResult.stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3),
      }));

    return JSON.stringify({ branch, changes, clean: changes.length === 0 }, null, 2);
  },
});

/**
 * Tool to create and checkout a new branch
 */
export const gitCreateBranchTool = createTool({
  name: "git_create_branch",
  description: "Create a new git branch and switch to it.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    branch_name: z.string().describe("Name for the new branch (e.g., 'fix/issue-123-add-feature')"),
  }),
  execute: async ({ branch_name }, ctx) => {
    const cwd = ctx.workingDirectory;
    const result = await runCommand(["git", "checkout", "-b", branch_name], cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Created and switched to branch: ${branch_name}`;
  },
});

/**
 * Tool to stage files
 */
export const gitAddTool = createTool({
  name: "git_add",
  description: "Stage files for commit. Use ['.'] to stage all changes.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    files: z.array(z.string()).describe("List of file paths to stage. Use ['.'] to stage all changes."),
  }),
  execute: async ({ files }, ctx) => {
    const cwd = ctx.workingDirectory;
    const result = await runCommand(["git", "add", ...files], cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Staged files: ${files.join(", ")}`;
  },
});

/**
 * Tool to commit staged changes
 */
export const gitCommitTool = createTool({
  name: "git_commit",
  description: "Commit staged changes with a message.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    message: z.string().describe("Commit message describing the changes"),
  }),
  execute: async ({ message }, ctx) => {
    const cwd = ctx.workingDirectory;
    const result = await runCommand(["git", "commit", "-m", message], cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Changes committed successfully:\n${result.stdout}`;
  },
});

/**
 * Tool to push branch to remote
 */
export const gitPushTool = createTool({
  name: "git_push",
  description: "Push the current branch to the remote repository.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    set_upstream: z.boolean().optional().describe("Whether to set upstream tracking (default: true for new branches)"),
  }),
  execute: async ({ set_upstream = true }, ctx) => {
    const cwd = ctx.workingDirectory;

    const branchResult = await runCommand(["git", "branch", "--show-current"], cwd);
    const branch = branchResult.stdout.trim();

    const args = ["git", "push"];
    if (set_upstream) {
      args.push("-u", "origin", branch);
    }

    const result = await runCommand(args, cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Pushed branch '${branch}' to remote\n${result.stdout || result.stderr}`;
  },
});

/**
 * Tool to clone a repository
 */
export const gitCloneTool = createTool({
  name: "git_clone",
  description: "Clone a GitHub repository to the workspace.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    repo_url: z.string().describe("Repository URL (HTTPS or SSH)"),
    directory: z.string().optional().describe("Target directory name (optional)"),
  }),
  execute: async ({ repo_url, directory }, ctx) => {
    const cwd = ctx.workingDirectory;

    const args = ["git", "clone", repo_url];
    if (directory) {
      args.push(directory);
    }

    const result = await runCommand(args, cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    const clonedDir = directory || repo_url.split("/").pop()?.replace(".git", "") || "repo";
    return `Repository cloned to: ${clonedDir}`;
  },
});

/**
 * Tool to run shell commands
 */
export const runShellTool = createTool({
  name: "run_shell",
  description: "Run a shell command in the workspace. Use for running tests, builds, or other development commands.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    command: z.string().describe("The shell command to run"),
  }),
  execute: async ({ command }, ctx) => {
    const cwd = ctx.workingDirectory;

    // Basic safety check
    const dangerous = ["rm -rf /", "sudo", "mkfs", "dd if=", "> /dev/"];
    if (dangerous.some((d) => command.includes(d))) {
      return "Error: This command is not allowed for safety reasons.";
    }

    const result = await runCommand(["sh", "-c", command], cwd);

    return JSON.stringify({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
    }, null, 2);
  },
});

export const gitTools = [
  gitStatusTool,
  gitCreateBranchTool,
  gitAddTool,
  gitCommitTool,
  gitPushTool,
  gitCloneTool,
  runShellTool,
];
