import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { AppConfig } from "../config/AppConfig.js";
import type { AppSecrets } from "../env/AppSecrets.js";
import { ResultError } from "../shared/ResultError.js";
import type { GitHubFileChange, GitHubNotesGateway, RemoteMarkdownFile } from "./GitHubNotesGateway.js";

export class OctokitGitHubNotesGateway implements GitHubNotesGateway {
  private readonly config: AppConfig;
  private readonly secrets: AppSecrets;

  public constructor(config: AppConfig, secrets: AppSecrets) {
    this.config = config;
    this.secrets = secrets;
  }

  public async validateRepositorySetup(): Promise<void> {
    const octokit = await this.createInstallationOctokit();
    const { account: owner, repo, branch } = this.config.notesGitHubRepository;
    await this.requireBranch(octokit, owner, repo, branch);
  }

  public async listMarkdownFiles(folder: string): Promise<readonly RemoteMarkdownFile[]> {
    const octokit = await this.createInstallationOctokit();
    const response = await octokit.rest.repos
      .getContent({
        owner: this.config.notesGitHubRepository.account,
        repo: this.config.notesGitHubRepository.repo,
        path: folder,
        ref: this.config.notesGitHubRepository.branch
      })
      .catch((error: unknown) => {
        if (isGitHubStatus(error, 404)) {
          return null;
        }

        throw this.toGitHubAccessError(error);
      });

    if (response === null) {
      return [];
    }

    if (!Array.isArray(response.data)) {
      throw this.repositorySetupError(
        `Configured path '${folder}' in '${this.notesRepositoryName()}' is not a folder on branch '${this.config.notesGitHubRepository.branch}'.`
      );
    }

    const markdownEntries = response.data.filter(
      (entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".md")
    );

    return Promise.all(markdownEntries.map((entry) => this.readMarkdownFile(entry.path)));
  }

  public async readMarkdownFile(filePath: string): Promise<RemoteMarkdownFile> {
    const octokit = await this.createInstallationOctokit();
    const response = await octokit.rest.repos
      .getContent({
        owner: this.config.notesGitHubRepository.account,
        repo: this.config.notesGitHubRepository.repo,
        path: filePath,
        ref: this.config.notesGitHubRepository.branch
      })
      .catch((error: unknown) => {
        throw this.toGitHubAccessError(error);
      });

    if (Array.isArray(response.data) || response.data.type !== "file" || response.data.content === undefined) {
      throw new ResultError("github_file_not_found", `GitHub file '${filePath}' was not found.`, 404);
    }

    return {
      path: response.data.path,
      sha: response.data.sha,
      content: Buffer.from(response.data.content, "base64").toString("utf8")
    };
  }

  public async commitChanges(message: string, changes: readonly GitHubFileChange[]): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    const octokit = await this.createInstallationOctokit();
    const { account: owner, repo, branch } = this.config.notesGitHubRepository;
    const ref = `heads/${branch}`;
    const currentRef = await octokit.rest.git.getRef({ owner, repo, ref }).catch((error: unknown) => {
      if (isEmptyRepositoryError(error)) {
        throw this.repositorySetupError(`GitHub repository '${this.notesRepositoryName()}' is empty.`);
      }

      throw this.toGitHubAccessError(error);
    });

    const baseCommitSha = currentRef.data.object.sha;
    const baseCommit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: baseCommitSha }).catch((error: unknown) => {
      throw this.toGitHubAccessError(error);
    });

    const tree = await octokit.rest.git
      .createTree({
        owner,
        repo,
        base_tree: baseCommit.data.tree.sha,
        tree: changes.map((change) => {
          if (change.type === "delete") {
            return {
              path: change.path,
              mode: "100644",
              type: "blob",
              sha: null
            };
          }

          return {
            path: change.path,
            mode: "100644",
            type: "blob",
            content: change.content
          };
        })
      })
      .catch((error: unknown) => {
        throw this.toGitHubAccessError(error);
      });

    const commit = await octokit.rest.git
      .createCommit({
        owner,
        repo,
        message,
        tree: tree.data.sha,
        parents: [baseCommitSha]
      })
      .catch((error: unknown) => {
        throw this.toGitHubAccessError(error);
      });

    await octokit.rest.git
      .updateRef({
        owner,
        repo,
        ref,
        sha: commit.data.sha,
        force: false
      })
      .catch((error: unknown) => {
        throw this.toGitHubAccessError(error);
      });
  }

  private async createInstallationOctokit(): Promise<Octokit> {
    const appAuth = createAppAuth({
      appId: this.secrets.githubAppId,
      privateKey: this.secrets.githubAppPrivateKey,
      clientId: this.secrets.githubAppClientId,
      clientSecret: this.secrets.githubAppClientSecret
    });
    const appAuthentication = await appAuth({ type: "app" });
    const appOctokit = new Octokit({ auth: appAuthentication.token });
    const installation = await appOctokit.rest.apps
      .getRepoInstallation({
        owner: this.config.notesGitHubRepository.account,
        repo: this.config.notesGitHubRepository.repo
      })
      .catch((error: unknown) => {
        if (isGitHubStatus(error, 404)) {
          const repoName = this.notesRepositoryName();
          throw new ResultError(
            "github_app_not_installed",
            `GitHub App is not installed on '${repoName}', or the installation has not been updated for that repository.`,
            403
          );
        }

        throw this.toGitHubAccessError(error);
      });
    const installationAuthentication = await appAuth({
      type: "installation",
      installationId: installation.data.id
    });

    return new Octokit({ auth: installationAuthentication.token });
  }

  private toGitHubAccessError(error: unknown): Error {
    if (error instanceof ResultError) {
      return error;
    }

    const repoName = this.notesRepositoryName();
    const message = githubErrorMessage(error);
    if (isGitHubStatus(error, 403) && message.includes("Resource not accessible by integration")) {
      return new ResultError(
        "github_app_repo_access_denied",
        `GitHub App cannot access '${repoName}'. Confirm it is installed on the notes repository, has Contents: Read and write, and the installation permissions were updated.`,
        403
      );
    }

    if (isGitHubStatus(error, 404)) {
      return this.repositorySetupError(`GitHub resource was not found in '${repoName}'.`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  private async requireBranch(octokit: Octokit, owner: string, repo: string, branch: string): Promise<void> {
    await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` }).catch((error: unknown) => {
      if (isEmptyRepositoryError(error)) {
        throw this.repositorySetupError(`GitHub repository '${this.notesRepositoryName()}' is empty.`);
      }

      if (isGitHubStatus(error, 404)) {
        throw this.repositorySetupError(`Branch '${branch}' was not found in '${this.notesRepositoryName()}'.`);
      }

      throw this.toGitHubAccessError(error);
    });
  }

  private repositorySetupError(detail: string): ResultError {
    const { branch } = this.config.notesGitHubRepository;
    return new ResultError(
      "github_repository_setup_invalid",
      `${detail} Expected setup: repository '${this.notesRepositoryName()}' exists, branch '${branch}' exists with at least one commit, and the GitHub App has Contents: Read and write access.`,
      409
    );
  }

  private notesRepositoryName(): string {
    const { account, repo } = this.config.notesGitHubRepository;
    return `${account}/${repo}`;
  }
}

function isGitHubStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { readonly status?: unknown }).status === status;
}

function githubErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const message = (error as { readonly message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function isEmptyRepositoryError(error: unknown): boolean {
  return isGitHubStatus(error, 409) && githubErrorMessage(error).includes("Git Repository is empty");
}
