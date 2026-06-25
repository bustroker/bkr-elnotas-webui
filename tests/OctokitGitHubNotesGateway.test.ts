import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "./fixtures.js";

const mockRest = vi.hoisted(() => ({
  apps: {
    getRepoInstallation: vi.fn()
  },
  git: {
    createCommit: vi.fn(),
    createRef: vi.fn(),
    createTree: vi.fn(),
    getCommit: vi.fn(),
    getRef: vi.fn(),
    updateRef: vi.fn()
  },
  repos: {
    getContent: vi.fn()
  }
}));

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: () => async (input: { readonly type: "app" | "installation" }) => ({
    token: input.type === "app" ? "app-token" : "installation-token"
  })
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    public readonly rest = mockRest;
  }
}));

describe("OctokitGitHubNotesGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRest.apps.getRepoInstallation.mockResolvedValue({ data: { id: 123 } });
    mockRest.git.createCommit.mockResolvedValue({ data: { sha: "commit-sha" } });
    mockRest.git.createRef.mockResolvedValue({});
    mockRest.git.createTree.mockResolvedValue({ data: { sha: "tree-sha" } });
    mockRest.repos.getContent.mockResolvedValue({ data: [] });
  });

  it("returns a setup error when committing to an empty repository", async () => {
    const { OctokitGitHubNotesGateway } = await import("../src/server/github/OctokitGitHubNotesGateway.js");
    mockRest.git.getRef.mockRejectedValue({ status: 409, message: "Git Repository is empty." });
    const gateway = new OctokitGitHubNotesGateway(testConfig(), {
      githubAppClientId: "client-id",
      githubAppClientSecret: "client-secret",
      githubAppId: "123",
      githubAppPrivateKey: "private-key",
      sessionSecret: "session-secret"
    });

    await expect(gateway.commitChanges("Add note", [{ type: "write", path: "notes/first.md", content: "body" }])).rejects.toMatchObject({
      code: "github_repository_setup_invalid",
      message: expect.stringContaining("Expected setup")
    });

    expect(mockRest.git.createTree).not.toHaveBeenCalled();
    expect(mockRest.git.createCommit).not.toHaveBeenCalled();
    expect(mockRest.git.createRef).not.toHaveBeenCalled();
    expect(mockRest.git.getCommit).not.toHaveBeenCalled();
    expect(mockRest.git.updateRef).not.toHaveBeenCalled();
  });

  it("validates that the configured branch exists", async () => {
    const { OctokitGitHubNotesGateway } = await import("../src/server/github/OctokitGitHubNotesGateway.js");
    mockRest.git.getRef.mockRejectedValue({ status: 404, message: "Not Found" });
    const gateway = new OctokitGitHubNotesGateway(testConfig(), {
      githubAppClientId: "client-id",
      githubAppClientSecret: "client-secret",
      githubAppId: "123",
      githubAppPrivateKey: "private-key",
      sessionSecret: "session-secret"
    });

    await expect(gateway.validateRepositorySetup()).rejects.toMatchObject({
      code: "github_repository_setup_invalid",
      message: expect.stringContaining("branch 'main'")
    });
  });

  it("returns no markdown files when a configured folder does not exist yet", async () => {
    const { OctokitGitHubNotesGateway } = await import("../src/server/github/OctokitGitHubNotesGateway.js");
    mockRest.repos.getContent.mockRejectedValue({ status: 404, message: "Not Found" });
    const gateway = new OctokitGitHubNotesGateway(testConfig(), {
      githubAppClientId: "client-id",
      githubAppClientSecret: "client-secret",
      githubAppId: "123",
      githubAppPrivateKey: "private-key",
      sessionSecret: "session-secret"
    });

    await expect(gateway.listMarkdownFiles("notes")).resolves.toEqual([]);
  });
});
