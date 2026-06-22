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

  public async listMarkdownFiles(folder: string): Promise<readonly RemoteMarkdownFile[]> {
    const octokit = await this.createInstallationOctokit();
    const response = await octokit.rest.repos.getContent({
      owner: this.config.notesGitHubRepository.account,
      repo: this.config.notesGitHubRepository.repo,
      path: folder,
      ref: this.config.notesGitHubRepository.branch
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    const markdownEntries = response.data.filter(
      (entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".md")
    );

    return Promise.all(markdownEntries.map((entry) => this.readMarkdownFile(entry.path)));
  }

  public async readMarkdownFile(filePath: string): Promise<RemoteMarkdownFile> {
    const octokit = await this.createInstallationOctokit();
    const response = await octokit.rest.repos.getContent({
      owner: this.config.notesGitHubRepository.account,
      repo: this.config.notesGitHubRepository.repo,
      path: filePath,
      ref: this.config.notesGitHubRepository.branch
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
    const currentRef = await octokit.rest.git.getRef({ owner, repo, ref });
    const baseCommitSha = currentRef.data.object.sha;
    const baseCommit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

    const tree = await octokit.rest.git.createTree({
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
    });

    const commit = await octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.data.sha,
      parents: [baseCommitSha]
    });

    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref,
      sha: commit.data.sha,
      force: false
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
    const installation = await appOctokit.rest.apps.getRepoInstallation({
      owner: this.config.notesGitHubRepository.account,
      repo: this.config.notesGitHubRepository.repo
    });
    const installationAuthentication = await appAuth({
      type: "installation",
      installationId: installation.data.id
    });

    return new Octokit({ auth: installationAuthentication.token });
  }
}
