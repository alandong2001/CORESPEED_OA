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
 * Resolve the working directory for git operations
 * If repo_path is provided, use issues_workspace/<repo_path>
 * Otherwise fall back to context working directory
 */
function resolveWorkDir(ctx: { workingDirectory: string }, repoPath?: string): string {
  if (repoPath) {
    // If it's already an absolute path or starts with issues_workspace, use as-is
    if (repoPath.startsWith("/") || repoPath.startsWith("issues_workspace")) {
      return repoPath.startsWith("/") ? repoPath : `${ctx.workingDirectory}/${repoPath}`;
    }
    // Otherwise, assume it's a repo name in issues_workspace
    return `${ctx.workingDirectory}/issues_workspace/${repoPath}`;
  }
  return ctx.workingDirectory;
}

/**
 * Verify we're operating on the expected repository
 */
async function verifyRepo(cwd: string, expectedRepo?: string): Promise<{ valid: boolean; actual?: string; error?: string }> {
  const result = await runCommand(["git", "remote", "get-url", "origin"], cwd);

  if (!result.success) {
    return { valid: false, error: "Not a git repository or no remote configured" };
  }

  const actualRemote = result.stdout.trim();

  if (expectedRepo && !actualRemote.includes(expectedRepo)) {
    return {
      valid: false,
      actual: actualRemote,
      error: `Expected repo '${expectedRepo}' but found '${actualRemote}'`
    };
  }

  return { valid: true, actual: actualRemote };
}

/**
 * Tool to get current git status
 */
export const gitStatusTool = createTool({
  name: "git_status",
  description: "Get the current git status including branch name, staged/unstaged changes. IMPORTANT: Always specify repo_path when working on cloned repositories.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo, or full path)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo') - prevents accidental operations on wrong repo"),
  }),
  execute: async ({ repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    // Verify we're in the right repo if expected_repo is specified
    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

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
 * Tool to checkout an existing branch
 */
export const gitCheckoutTool = createTool({
  name: "git_checkout",
  description: "Switch to an existing git branch. Use this to work on existing PR branches.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    branch_name: z.string().describe("Name of the branch to checkout"),
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo')"),
  }),
  execute: async ({ branch_name, repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

    // First fetch to get latest branches
    await runCommand(["git", "fetch", "origin"], cwd);

    // Try to checkout the branch
    let result = await runCommand(["git", "checkout", branch_name], cwd);

    // If local branch doesn't exist, try to checkout from remote
    if (!result.success && result.stderr.includes("did not match any")) {
      result = await runCommand(["git", "checkout", "-b", branch_name, `origin/${branch_name}`], cwd);
    }

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Switched to branch: ${branch_name}`;
  },
});

/**
 * Tool to create and checkout a new branch
 */
export const gitCreateBranchTool = createTool({
  name: "git_create_branch",
  description: "Create a NEW git branch and switch to it. Use git_checkout for existing branches.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    branch_name: z.string().describe("Name for the new branch (e.g., 'fix/issue-123-add-feature')"),
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo')"),
  }),
  execute: async ({ branch_name, repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

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
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo')"),
  }),
  execute: async ({ files, repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

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
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo')"),
  }),
  execute: async ({ message, repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

    const result = await runCommand(["git", "commit", "-m", message], cwd);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return `Changes committed successfully:\n${result.stdout}`;
  },
});

/**
 * Tool to push branch to remote
 * SECURITY: Blocks pushing directly to main/master branches
 */
export const gitPushTool = createTool({
  name: "git_push",
  description: "Push the current branch to the remote repository. NOTE: Cannot push to main/master directly - must use a feature branch.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    set_upstream: z.boolean().optional().describe("Whether to set upstream tracking (default: true for new branches)"),
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
    expected_repo: z.string().optional().describe("Expected repo name to verify (e.g., 'owner/repo')"),
  }),
  execute: async ({ set_upstream = true, repo_path, expected_repo }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    if (expected_repo) {
      const verification = await verifyRepo(cwd, expected_repo);
      if (!verification.valid) {
        return `Error: ${verification.error}`;
      }
    }

    const branchResult = await runCommand(["git", "branch", "--show-current"], cwd);
    const branch = branchResult.stdout.trim();

    // SECURITY: Prevent pushing directly to main/master
    const protectedBranches = ["main", "master", "develop", "production"];
    if (protectedBranches.includes(branch.toLowerCase())) {
      return `Error: Cannot push directly to '${branch}'. Create a feature branch first using git_create_branch, then push and create a pull request.`;
    }

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
 * Tool to clone a repository into issues_workspace
 */
export const gitCloneTool = createTool({
  name: "git_clone",
  description: "Clone a GitHub repository to issues_workspace folder. Returns the repo_path to use with other git tools.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    repo_url: z.string().describe("Repository URL (HTTPS or SSH)"),
    directory: z.string().optional().describe("Target directory name (optional, defaults to repo name)"),
  }),
  execute: async ({ repo_url, directory }, ctx) => {
    const baseDir = ctx.workingDirectory;
    const workspaceDir = `${baseDir}/issues_workspace`;

    // Ensure issues_workspace directory exists
    await runCommand(["mkdir", "-p", workspaceDir], baseDir);

    const repoName = directory || repo_url.split("/").pop()?.replace(".git", "") || "repo";
    const targetPath = `${workspaceDir}/${repoName}`;

    // Check if already cloned
    const exists = await runCommand(["test", "-d", targetPath], baseDir);
    if (exists.success) {
      return JSON.stringify({
        already_exists: true,
        repo_path: repoName,
        full_path: targetPath,
        message: `Repository already exists. Use repo_path: "${repoName}" with other git tools.`,
      }, null, 2);
    }

    const result = await runCommand(["git", "clone", repo_url, targetPath], baseDir);

    if (!result.success) {
      return `Error: ${result.stderr}`;
    }

    return JSON.stringify({
      success: true,
      repo_path: repoName,
      full_path: targetPath,
      message: `Repository cloned. Use repo_path: "${repoName}" with other git tools.`,
    }, null, 2);
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
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
  }),
  execute: async ({ command, repo_path }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

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

/**
 * Tool to run tests - should be used before committing changes
 */
export const runTestsTool = createTool({
  name: "run_tests",
  description: "Run the project's test suite to verify changes work correctly. IMPORTANT: Always run tests before committing changes.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    test_command: z.string().optional().describe("Custom test command (auto-detects if not provided)"),
    repo_path: z.string().optional().describe("Repository path (e.g., 'my-repo' for issues_workspace/my-repo)"),
  }),
  execute: async ({ test_command, repo_path }, ctx) => {
    const cwd = resolveWorkDir(ctx, repo_path);

    // Auto-detect test command based on project type
    let command = test_command;
    if (!command) {
      // Check for common test configurations
      const checks = [
        { file: "package.json", cmd: "npm test" },
        { file: "deno.json", cmd: "deno test" },
        { file: "Cargo.toml", cmd: "cargo test" },
        { file: "go.mod", cmd: "go test ./..." },
        { file: "pytest.ini", cmd: "pytest" },
        { file: "setup.py", cmd: "python -m pytest" },
      ];

      for (const check of checks) {
        const exists = await runCommand(["test", "-f", check.file], cwd);
        if (exists.success) {
          command = check.cmd;
          break;
        }
      }
    }

    if (!command) {
      return "No test command found. Please specify a test_command or ensure the project has a standard test configuration.";
    }

    const result = await runCommand(["sh", "-c", command], cwd);

    return JSON.stringify({
      success: result.success,
      test_command: command,
      stdout: result.stdout,
      stderr: result.stderr,
      summary: result.success ? "All tests passed!" : "Some tests failed. Please fix before committing.",
    }, null, 2);
  },
});

export const gitTools = [
  gitStatusTool,
  gitCheckoutTool,
  gitCreateBranchTool,
  gitAddTool,
  gitCommitTool,
  gitPushTool,
  gitCloneTool,
  runShellTool,
  runTestsTool,
];
