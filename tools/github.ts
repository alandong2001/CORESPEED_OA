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
 * Parse a GitHub PR URL into owner, repo, and PR number
 */
function parsePrUrl(url: string): { owner: string; repo: string; prNumber: number } {
  const urlPattern = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

  const match = url.match(urlPattern);
  if (match) {
    return { owner: match[1], repo: match[2], prNumber: parseInt(match[3]) };
  }

  throw new Error(`Invalid PR URL format: ${url}. Expected format: https://github.com/owner/repo/pull/123`);
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

/**
 * Tool to fetch PR details including branch info
 */
export const fetchPrDetailsTool = createTool({
  name: "fetch_pr_details",
  description: "Fetch details of a GitHub pull request including title, description, branch names, and status.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    pr_url: z.string().describe("The GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)"),
  }),
  execute: async ({ pr_url }) => {
    try {
      const { owner, repo, prNumber } = parsePrUrl(pr_url);

      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error fetching PR: ${error}`;
      }

      const pr = await response.json();

      return JSON.stringify({
        number: pr.number,
        title: pr.title,
        body: pr.body || "(no description)",
        state: pr.state,
        merged: pr.merged,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
        author: pr.user.login,
        html_url: pr.html_url,
        repository: { owner, repo, full_name: `${owner}/${repo}` },
        clone_url: pr.head.repo?.clone_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * Tool to fetch PR review comments (inline code comments)
 */
export const fetchPrReviewCommentsTool = createTool({
  name: "fetch_pr_review_comments",
  description: "Fetch review comments on a pull request. These are inline comments on specific lines of code.",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    pr_url: z.string().describe("The GitHub PR URL"),
  }),
  execute: async ({ pr_url }) => {
    try {
      const { owner, repo, prNumber } = parsePrUrl(pr_url);

      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error fetching PR comments: ${error}`;
      }

      const comments = await response.json();

      const formattedComments = comments.map((c: {
        user: { login: string };
        body: string;
        path: string;
        line: number;
        created_at: string;
      }) => ({
        author: c.user.login,
        body: c.body,
        file: c.path,
        line: c.line,
        created_at: c.created_at,
      }));

      return JSON.stringify({
        total_comments: formattedComments.length,
        comments: formattedComments,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * Tool to fetch PR reviews (approve/request changes/comment)
 */
export const fetchPrReviewsTool = createTool({
  name: "fetch_pr_reviews",
  description: "Fetch reviews on a pull request (approvals, change requests, and general review comments).",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    pr_url: z.string().describe("The GitHub PR URL"),
  }),
  execute: async ({ pr_url }) => {
    try {
      const { owner, repo, prNumber } = parsePrUrl(pr_url);

      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error fetching PR reviews: ${error}`;
      }

      const reviews = await response.json();

      const formattedReviews = reviews.map((r: {
        user: { login: string };
        body: string;
        state: string;
        submitted_at: string;
      }) => ({
        author: r.user.login,
        state: r.state, // APPROVED, CHANGES_REQUESTED, COMMENTED, PENDING
        body: r.body || "(no comment)",
        submitted_at: r.submitted_at,
      }));

      return JSON.stringify({
        total_reviews: formattedReviews.length,
        reviews: formattedReviews,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

/**
 * Tool to fetch PR conversation comments (non-inline comments)
 */
export const fetchPrConversationTool = createTool({
  name: "fetch_pr_conversation",
  description: "Fetch general conversation comments on a pull request (not inline code comments).",
  schema: z.object({
    explanation: z.string().describe("One sentence explanation as to why this tool is being used"),
    pr_url: z.string().describe("The GitHub PR URL"),
  }),
  execute: async ({ pr_url }) => {
    try {
      const { owner, repo, prNumber } = parsePrUrl(pr_url);

      // PR conversation uses the issues API
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        const error = await response.text();
        return `Error fetching PR conversation: ${error}`;
      }

      const comments = await response.json();

      const formattedComments = comments.map((c: {
        user: { login: string };
        body: string;
        created_at: string;
      }) => ({
        author: c.user.login,
        body: c.body,
        created_at: c.created_at,
      }));

      return JSON.stringify({
        total_comments: formattedComments.length,
        comments: formattedComments,
      }, null, 2);
    } catch (error) {
      return `Error: ${String(error)}`;
    }
  },
});

export const githubTools = [
  fetchIssueTool,
  createPullRequestTool,
  getRepoInfoTool,
  fetchPrDetailsTool,
  fetchPrReviewCommentsTool,
  fetchPrReviewsTool,
  fetchPrConversationTool,
];
