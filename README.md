# Issue-to-PR Agent

An autonomous AI agent built with [Zypher](https://zypher.corespeed.io) that takes GitHub issues and implements solutions by creating pull requests.

## Features

- **Autonomous Implementation**: Give it a GitHub issue URL, and it will:
  1. Fetch and analyze the issue
  2. Clone the repository
  3. Explore the codebase to understand context
  4. Plan and implement the solution
  5. Create a branch, commit changes, and open a PR

- **Built-in Tools**:
  - File operations (read, edit, search)
  - Git operations (branch, commit, push)
  - GitHub API integration (fetch issues, create PRs)
  - Shell command execution

## Prerequisites

- [Deno](https://deno.land/) 2.0+
- [Anthropic API Key](https://console.anthropic.com/)
- [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope

## Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/issue-to-pr-agent.git
   cd issue-to-pr-agent
   ```

2. Create a `.env` file with your API keys:
   ```bash
   cp .env.example .env
   # Edit .env and add your keys
   ```

3. Install dependencies:
   ```bash
   deno install
   ```

## Usage

Run the agent in interactive mode:

```bash
deno task start
```

Then enter a task like:
- `Implement https://github.com/owner/repo/issues/123`
- `Fix the bug described in owner/repo#45`

## How It Works

```
┌─────────────────┐
│  GitHub Issue   │
│  URL or #123    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Fetch Issue    │  ← GitHub API
└────────┬────────┘
         ▼
┌─────────────────┐
│ Explore Codebase│  ← File read, grep, list
└────────┬────────┘
         ▼
┌─────────────────┐
│  Plan Solution  │  ← LLM reasoning
└────────┬────────┘
         ▼
┌─────────────────┐
│  Implement Fix  │  ← File edit/write
└────────┬────────┘
         ▼
┌─────────────────┐
│  Create PR      │  ← Git + GitHub API
└─────────────────┘
```

## Project Structure

```
issue-to-pr-agent/
├── main.ts           # Entry point
├── tools/
│   ├── github.ts     # GitHub API tools
│   └── git.ts        # Git command tools
├── prompts/
│   └── system.md     # Agent system prompt
├── deno.json         # Deno config
└── .env.example      # Environment template
```

## Built With

- [Zypher Agent Framework](https://zypher.corespeed.io) - AI agent framework by CoreSpeed
- [Anthropic Claude](https://anthropic.com) - LLM provider
- [Deno](https://deno.land) - Runtime

## License

MIT
