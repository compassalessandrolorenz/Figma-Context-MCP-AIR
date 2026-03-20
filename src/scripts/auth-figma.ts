#!/usr/bin/env node
import { OAuthTokenManager } from "../remote/oauth-manager.js";

/**
 * CLI script for Figma OAuth authentication
 *
 * This script guides users through the OAuth flow to authenticate
 * with Figma's remote MCP server.
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Figma Remote MCP Authentication");
  console.log("=".repeat(60));
  console.log();

  const tokenManager = new OAuthTokenManager();

  // Check if token already exists
  const hasToken = await tokenManager.hasValidToken();
  if (hasToken) {
    console.log("✓ You are already authenticated with Figma remote MCP server");
    console.log();
    console.log("Token location:", tokenManager.getTokenPath());
    console.log();
    console.log("To re-authenticate, delete the token file and run this script again:");
    console.log(`  rm ${tokenManager.getTokenPath()}`);
    console.log();
    return;
  }

  console.log("⚠️  OAuth authentication flow not yet implemented");
  console.log();
  console.log("TEMPORARY WORKAROUND:");
  console.log("1. Manually authenticate using Claude Code or another supported client");
  console.log("2. Copy the OAuth token from their configuration");
  console.log("3. Create the token file with the following format:");
  console.log();
  console.log(`Token file location: ${tokenManager.getTokenPath()}`);
  console.log();
  console.log("Token file format:");
  console.log(
    JSON.stringify(
      {
        accessToken: "your_token_here",
        tokenType: "Bearer",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      null,
      2,
    ),
  );
  console.log();
  console.log("TODO: Implement full OAuth flow with browser redirect");
  console.log(
    "See: https://developers.figma.com/docs/figma-mcp-server/installation-and-setup/remote-server/",
  );
  console.log();
}

main().catch((error) => {
  console.error("Authentication failed:", error);
  process.exit(1);
});
