import fs from "fs/promises";
import path from "path";
import os from "os";

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
}

export class OAuthTokenManager {
  private tokenPath: string;
  private oauthConfig?: OAuthConfig;

  constructor(tokenPath?: string, oauthConfig?: OAuthConfig) {
    this.tokenPath = tokenPath || path.join(os.homedir(), ".figma", "mcp-token.json");
    this.oauthConfig = oauthConfig;
  }

  /**
   * Load OAuth token from disk
   */
  async loadToken(): Promise<OAuthToken | null> {
    try {
      const data = await fs.readFile(this.tokenPath, "utf-8");
      const token = JSON.parse(data) as OAuthToken;

      // Check if token is expired
      if (token.expiresAt && Date.now() >= token.expiresAt) {
        console.warn("OAuth token has expired");
        return null;
      }

      return token;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null; // Token file doesn't exist
      }
      throw error;
    }
  }

  /**
   * Save OAuth token to disk
   */
  async saveToken(token: OAuthToken): Promise<void> {
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2), "utf-8");
  }

  /**
   * Delete OAuth token from disk
   */
  async deleteToken(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Check if token exists and is valid
   */
  async hasValidToken(): Promise<boolean> {
    const token = await this.loadToken();
    return token !== null;
  }

  /**
   * Get token path for debugging
   */
  getTokenPath(): string {
    return this.tokenPath;
  }

  /**
   * Refresh OAuth token using refresh token
   */
  async refreshToken(): Promise<OAuthToken | null> {
    if (!this.oauthConfig) {
      throw new Error("OAuth configuration not provided. Cannot refresh token.");
    }

    const currentToken = await this.loadToken();
    if (!currentToken?.refreshToken) {
      console.warn("No refresh token available");
      return null;
    }

    const tokenUrl = this.oauthConfig.tokenUrl || "https://api.figma.com/v1/oauth/token";

    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      refresh_token: currentToken.refreshToken,
      grant_type: "refresh_token",
    });

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      const newToken: OAuthToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || currentToken.refreshToken,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        tokenType: data.token_type,
      };

      await this.saveToken(newToken);
      return newToken;
    } catch (error) {
      console.error("Token refresh error:", (error as Error).message);
      return null;
    }
  }

  /**
   * Get valid token, refreshing if necessary
   */
  async getValidToken(): Promise<OAuthToken | null> {
    const token = await this.loadToken();

    if (!token) {
      return null;
    }

    // Check if token is expired or will expire in next 5 minutes
    if (token.expiresAt && Date.now() >= token.expiresAt - 5 * 60 * 1000) {
      console.log("Token expired or expiring soon, attempting refresh...");
      return await this.refreshToken();
    }

    return token;
  }
}
