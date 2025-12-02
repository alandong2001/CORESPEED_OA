/**
 * GitHub API tools for fetching issues and creating pull requests
 */

import { createTool } from "@corespeed/zypher/tools";
import { z } from "npm:zod";

const GITHUB_API_BASE = "https://api.github.com";

function getHeaders(): HeadersInit {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Issue-to-PR-Agent",
  };
}

/**
 * Parse a GitHub issue URL into owner, repo, and issue number
 */
function parseIssueUrl(url: string): { owner: string; repo: string; issueNumber: number } {
  const urlPattern = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
  const shortPattern = /^([^/]+)\/([^#]+)#(\d+)$/;

  let match = url.match(urlPattern);
  if (match) {
    return { owner: match[1], repo: match[2], issueNumber: parseInt(match[3]) };
  }

  match = url.match(shortPattern);
  if (match) {
    return { owner: match[1], repo: match[2], issueNumber: parseInt(match[3]) };
  }

  throw new Error(`Invalid issue URL format: ${url}. Expected format: https://github.com/owner/repo/issues/123 or owner/repo#123`);
}

/**
 * Tool to fetch a GitHub issue's details
 */
export const fetchIssueTool = createTool({
  name: "fetch_github_issue",
  description: "Fetch details of a GitHub issue including title, body, labels, and comments. Provide the full issue URL (e.g., https://github.com/owner/repo/issues/123) or short format (owner/repo#123).",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    issue_url: z.string().describe("The GitHub issue URL or short reference (e.g., owner/repo#123)"),
  }),
  execute: async ({ issue_url }) => {
    try {
      const { owner, repo, issueNumber } = parseIssueUrl(issue_url);

      const issueResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}`,
        { headers: getHeaders() }
      );

      if (!issueResponse.ok) {
        const error = await issueResponse.text();
        return `Error fetching issue: ${error}`;
      }

      const issue = await issueResponse.json();

      const commentsResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        { headers: getHeaders() }
      );

      const comments = commentsResponse.ok ? await commentsResponse.json() : [];

      const result = {
        number: issue.number,
        title: issue.title,
        body: issue.body || "(no description)",
        state: issue.state,
        labels: issue.labels.map((l: { name: string }) => l.name),
        author: issue.user.login,
        created_at: issue.created_at,
        html_url: issue.html_url,
        repository: { owner, repo, full_name: `${owner}/${repo}` },
        comments: comments.map((c: { user: { login: string }; body: string; created_at: string }) => ({
          author: c.user.login,
          body: c.body,
          created_at: c.created_at,
        })),
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * Tool to create a pull request
 */
export const createPullRequestTool = createTool({
  name: "create_pull_request",
  description: "Create a GitHub pull request. The branch must already be pushed to the remote repository.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title"),
    body: z.string().describe("PR description/body (markdown supported)"),
    head: z.string().describe("The name of the branch where your changes are implemented"),
    base: z.string().describe("The name of the branch you want the changes pulled into (usually 'main' or 'master')"),
  }),
  execute: async (params) => {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/pulls`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            title: params.title,
            body: params.body,
            head: params.head,
            base: params.base,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error creating PR: ${error}`;
      }

      const pr = await response.json();

      return JSON.stringify({
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        state: pr.state,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * Tool to get repository information
 */
export const getRepoInfoTool = createTool({
  name: "get_repo_info",
  description: "Get information about a GitHub repository including default branch, description, and clone URL.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  }),
  execute: async ({ owner, repo }) => {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error fetching repo: ${error}`;
      }

      const repoData = await response.json();

      return JSON.stringify({
        full_name: repoData.full_name,
        description: repoData.description,
        default_branch: repoData.default_branch,
        clone_url: repoData.clone_url,
        ssh_url: repoData.ssh_url,
        html_url: repoData.html_url,
        private: repoData.private,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

export const githubTools = [fetchIssueTool, createPullRequestTool, getRepoInfoTool];
