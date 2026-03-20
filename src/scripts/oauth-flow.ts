#!/usr/bin/env node
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { OAuthTokenManager } from "../remote/oauth-manager.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Figma OAuth configuration
 * Reference: https://www.figma.com/developers/api#oauth2
 */
const FIGMA_OAUTH_CONFIG = {
  clientId: process.env.FIGMA_CLIENT_ID || "",
  clientSecret: process.env.FIGMA_CLIENT_SECRET || "",
  redirectUri: "http://localhost:3000/callback",
  authorizationUrl: "https://www.figma.com/oauth",
  tokenUrl: "https://api.figma.com/v1/oauth/token",
  scope: "file_content:read file_variables:read",
};

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;

  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  try {
    await execAsync(command);
  } catch {
    console.error("Failed to open browser automatically. Please open this URL manually:");
    console.error(url);
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}> {
  const params = new URLSearchParams({
    client_id: FIGMA_OAUTH_CONFIG.clientId,
    client_secret: FIGMA_OAUTH_CONFIG.clientSecret,
    redirect_uri: FIGMA_OAUTH_CONFIG.redirectUri,
    code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(FIGMA_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Test connection to Figma MCP server
 */
async function testMCPConnection(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch("https://mcp.figma.com/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    if (!response.ok) {
      console.error(`MCP connection test failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    console.log("✓ MCP server responded successfully");
    console.log(`  Found ${data.result?.tools?.length || 0} tools`);
    return true;
  } catch (error) {
    console.error("MCP connection test error:", (error as Error).message);
    return false;
  }
}

/**
 * Start OAuth flow
 */
async function startOAuthFlow(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Figma OAuth Browser Flow");
  console.log("=".repeat(60));
  console.log();

  // Validate configuration
  if (!FIGMA_OAUTH_CONFIG.clientId || !FIGMA_OAUTH_CONFIG.clientSecret) {
    console.error("❌ Missing OAuth configuration");
    console.error("   Please set the following environment variables:");
    console.error("   - FIGMA_CLIENT_ID");
    console.error("   - FIGMA_CLIENT_SECRET");
    console.error();
    console.error("   Get these from: https://www.figma.com/developers/apps");
    process.exit(1);
  }

  console.log("✓ OAuth configuration loaded");
  console.log(`  Client ID: ${FIGMA_OAUTH_CONFIG.clientId.substring(0, 10)}...`);
  console.log();

  // Create Express app for callback
  const app = express();
  const server = createServer(app);

  // Store the authorization code
  let authCode: string | null = null;
  let serverClosed = false;

  // Callback endpoint
  app.get("/callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>❌ Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
      console.error(`❌ Authorization error: ${error}`);
      process.exit(1);
      return;
    }

    if (!code) {
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>❌ No Authorization Code</h1>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
      console.error("❌ No authorization code received");
      process.exit(1);
      return;
    }

    authCode = code;

    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✓ Authorization Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
          <script>setTimeout(() => window.close(), 2000);</script>
        </body>
      </html>
    `);

    // Close server after response is sent
    setTimeout(() => {
      if (!serverClosed) {
        serverClosed = true;
        server.close();
      }
    }, 1000);
  });

  // Start server
  await new Promise<void>((resolve) => {
    server.listen(3000, () => {
      console.log("✓ Local callback server started on http://localhost:3000");
      resolve();
    });
  });

  // Build authorization URL
  const authUrl = new URL(FIGMA_OAUTH_CONFIG.authorizationUrl);
  authUrl.searchParams.set("client_id", FIGMA_OAUTH_CONFIG.clientId);
  authUrl.searchParams.set("redirect_uri", FIGMA_OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set("scope", FIGMA_OAUTH_CONFIG.scope);
  authUrl.searchParams.set("state", Math.random().toString(36).substring(7));
  authUrl.searchParams.set("response_type", "code");

  console.log();
  console.log("Opening browser for authorization...");
  console.log("If the browser does not open automatically, visit:");
  console.log(authUrl.toString());
  console.log();

  // Open browser
  await openBrowser(authUrl.toString());

  // Wait for authorization code
  console.log("Waiting for authorization...");
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (authCode || serverClosed) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  if (!authCode) {
    console.error("❌ Authorization failed or was cancelled");
    process.exit(1);
  }

  console.log("✓ Authorization code received");
  console.log();

  // Exchange code for token
  console.log("Exchanging authorization code for access token...");
  try {
    const tokenResponse = await exchangeCodeForToken(authCode);
    console.log("✓ Access token received");
    console.log();

    // Save token
    const tokenManager = new OAuthTokenManager();
    const expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : undefined;

    await tokenManager.saveToken({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      tokenType: tokenResponse.token_type,
    });

    console.log("✓ Token saved to:", tokenManager.getTokenPath());
    console.log();

    // Test MCP connection
    console.log("Testing connection to Figma MCP server...");
    const connectionSuccess = await testMCPConnection(tokenResponse.access_token);
    console.log();

    if (connectionSuccess) {
      console.log("=".repeat(60));
      console.log("✅ OAuth flow completed successfully!");
      console.log("=".repeat(60));
      console.log();
      console.log("Next steps:");
      console.log("1. Set FIGMA_REMOTE_MCP_ENABLED=true in your environment");
      console.log("2. Run: npm run test:remote");
      console.log();
    } else {
      console.log("=".repeat(60));
      console.log("⚠️  OAuth flow completed but MCP connection test failed");
      console.log("=".repeat(60));
      console.log();
      console.log("The token was saved, but there may be an issue with the MCP server.");
      console.log("Try running: npm run test:remote");
      console.log();
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Token exchange failed:", (error as Error).message);
    process.exit(1);
  }
}

// Run the OAuth flow
startOAuthFlow().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
