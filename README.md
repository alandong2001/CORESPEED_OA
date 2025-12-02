# Issue-to-PR Agent

An autonomous AI agent built with [Zypher](https://zypher.corespeed.io) that takes GitHub issues and implements solutions by creating pull requests.

## Features

- **Autonomous Implementation**: Give it a GitHub issue URL, and it will:
  1. Fetch and analyze the issue
  2. Check for existing PRs (prevents duplicates)
  3. Clone the repository to isolated workspace
  4. Explore the codebase to understand context
  5. Plan and implement the solution
  6. Run tests, commit changes, and open a PR

- **PR Follow-up**: Address reviewer feedback on existing PRs:
  1. Fetch PR details and review comments
  2. Checkout the existing PR branch
  3. Make requested changes
  4. Push updates to the PR

- **Repository Safety**:
  - Clones repos to isolated `issues_workspace/` folder
  - Verifies correct repo before git operations
  - Prevents accidental pushes to main/master
  - Detects existing PRs to avoid duplicates

- **Built-in Tools**:
  - File operations (read, edit, search, list)
  - Git operations (clone, branch, checkout, commit, push)
  - GitHub API (issues, PRs, reviews, comments)
  - Test runner with auto-detection
  - Shell command execution

## Prerequisites

- [Deno](https://deno.land/) 2.0+
- [Anthropic API Key](https://console.anthropic.com/)
- [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `GITHUB_TOKEN` | Yes | GitHub token with `repo` scope |
| `MODEL` | No | Model to use (default: `claude-sonnet-4-20250514`) |

### Available Models

| Model | Description |
|-------|-------------|
| `claude-sonnet-4-5-20250929` | Latest, best for coding & agents |
| `claude-opus-4-1-20250805` | Best for agentic tasks & reasoning |
| `claude-haiku-4-5-20251015` | Fast, low cost |
| `claude-sonnet-4-20250514` | Default, balanced |
| `claude-opus-4-20250514` | Capable |

## Setup

1. Install [Deno](https://deno.land/) if not already installed:
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. Add Deno to your PATH (add to `~/.zshrc` or `~/.bashrc` for permanence):
   ```bash
   export PATH="$HOME/.deno/bin:$PATH"
   ```

3. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/issue-to-pr-agent.git
   cd issue-to-pr-agent
   ```

4. Create a `.env` file with your API keys:
   ```bash
   cp .env.example .env
   # Edit .env and add your keys
   ```

5. Install dependencies:
   ```bash
   deno install
   ```

## Usage

Run the agent in interactive mode:

```bash
deno task start
```

Or specify a different model:

```bash
MODEL=claude-opus-4-20250514 deno task start
```

### Example Tasks

**New Issue:**
```
Implement https://github.com/owner/repo/issues/123
```

**Existing PR Follow-up:**
```
Address the review comments on https://github.com/owner/repo/pull/456
```

**Short Format:**
```
Fix the bug in owner/repo#45
```

## How It Works

### New Issue Workflow

```
┌─────────────────┐
│  GitHub Issue   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Check for PRs   │  ← Prevents duplicates
└────────┬────────┘
         ▼
┌─────────────────┐
│  Clone Repo     │  → issues_workspace/
└────────┬────────┘
         ▼
┌─────────────────┐
│ Create Branch   │  ← fix/issue-123-desc
└────────┬────────┘
         ▼
┌─────────────────┐
│  Implement Fix  │  ← Edit files
└────────┬────────┘
         ▼
┌─────────────────┐
│   Run Tests     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Create PR      │
└─────────────────┘
```

### PR Follow-up Workflow

```
┌─────────────────┐
│   PR URL        │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Fetch Reviews   │  ← Comments, approvals
└────────┬────────┘
         ▼
┌─────────────────┐
│ Checkout Branch │  ← Existing PR branch
└────────┬────────┘
         ▼
┌─────────────────┐
│ Address Changes │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Push Updates   │  → Updates PR
└─────────────────┘
```

## Project Structure

```
issue-to-pr-agent/
├── main.ts           # Entry point
├── tools/
│   ├── github.ts     # GitHub API tools (8 tools)
│   └── git.ts        # Git command tools (9 tools)
├── prompts/
│   └── system.md     # Agent system prompt
├── deno.json         # Deno config
└── .env.example      # Environment template
```

## Tools Reference

### GitHub Tools
| Tool | Description |
|------|-------------|
| `fetch_github_issue` | Get issue details and comments |
| `find_linked_prs` | Check for existing PRs (use before creating new PR) |
| `fetch_pr_details` | Get PR info including branch name |
| `fetch_pr_reviews` | Get review status (approve/changes requested) |
| `fetch_pr_review_comments` | Get inline code comments |
| `fetch_pr_conversation` | Get discussion comments |
| `create_pull_request` | Create a new PR |
| `get_repo_info` | Get repository metadata |

### Git Tools
| Tool | Description |
|------|-------------|
| `git_clone` | Clone repo to issues_workspace/ |
| `git_status` | Check current state |
| `git_checkout` | Switch to existing branch |
| `git_create_branch` | Create new branch |
| `git_add` | Stage files |
| `git_commit` | Commit changes |
| `git_push` | Push to remote (blocks main/master) |
| `run_tests` | Run test suite (auto-detects) |
| `run_shell` | Run shell commands |

## Built With

- [Zypher Agent Framework](https://zypher.corespeed.io) - AI agent framework by CoreSpeed
- [Anthropic Claude](https://anthropic.com) - LLM provider
- [Deno](https://deno.land) - Runtime

## License

MIT
