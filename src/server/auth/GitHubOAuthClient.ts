import type { AppSecrets } from "../env/AppSecrets.js";
import { ResultError } from "../shared/ResultError.js";

export interface GitHubUser {
  readonly login: string;
}

export class GitHubOAuthClient {
  private readonly secrets: AppSecrets;

  public constructor(secrets: AppSecrets) {
    this.secrets = secrets;
  }

  public authorizationUrl(input: { readonly redirectUri: string; readonly state: string }): string {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.secrets.githubAppClientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  public async exchangeCodeForUser(input: { readonly code: string; readonly redirectUri: string }): Promise<GitHubUser> {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: this.secrets.githubAppClientId,
        client_secret: this.secrets.githubAppClientSecret,
        code: input.code,
        redirect_uri: input.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      throw new ResultError("github_oauth_failed", "GitHub OAuth token exchange failed.", 502);
    }

    const tokenPayload = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (tokenPayload.access_token === undefined) {
      throw new ResultError("github_oauth_denied", tokenPayload.error ?? "GitHub OAuth did not return a token.", 401);
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!userResponse.ok) {
      throw new ResultError("github_user_failed", "GitHub user lookup failed.", 502);
    }

    const userPayload = (await userResponse.json()) as { login?: string };
    if (typeof userPayload.login !== "string" || userPayload.login.trim().length === 0) {
      throw new ResultError("github_user_invalid", "GitHub user response did not include a login.", 502);
    }

    return { login: userPayload.login };
  }
}
