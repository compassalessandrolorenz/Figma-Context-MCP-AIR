#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Script to find Figma OAuth token from various MCP client configurations
 */

interface TokenLocation {
  name: string;
  path: string;
  parser: (content: string) => string | null;
}

const tokenLocations: TokenLocation[] = [
  {
    name: "VSCode MCP Config (AppData)",
    path: path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "mcp.json"),
    parser: (content: string) => {
      try {
        const config = JSON.parse(content);
        // Check for token in various possible locations
        if (config.servers?.figma?.token) {
          return config.servers.figma.token;
        }
        if (config.servers?.figma?.auth?.token) {
          return config.servers.figma.auth.token;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "VSCode MCP Tokens (AppData)",
    path: path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "mcp-tokens.json"),
    parser: (content: string) => {
      try {
        const tokens = JSON.parse(content);
        if (tokens.figma) {
          return tokens.figma;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "Claude Code MCP Config",
    path: path.join(os.homedir(), ".claude", "mcp.json"),
    parser: (content: string) => {
      try {
        const config = JSON.parse(content);
        if (config.mcpServers?.figma?.auth?.token) {
          return config.mcpServers.figma.auth.token;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "VSCode MCP Settings",
    path: path.join(os.homedir(), ".vscode", "mcp-settings.json"),
    parser: (content: string) => {
      try {
        const config = JSON.parse(content);
        if (config.figma?.token) {
          return config.figma.token;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "Cursor MCP Config",
    path: path.join(os.homedir(), ".cursor", "mcp.json"),
    parser: (content: string) => {
      try {
        const config = JSON.parse(content);
        if (config.mcpServers?.figma?.auth?.token) {
          return config.mcpServers.figma.auth.token;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "Figma MCP Token (our format)",
    path: path.join(os.homedir(), ".figma", "mcp-token.json"),
    parser: (content: string) => {
      try {
        const token = JSON.parse(content);
        if (token.accessToken) {
          return token.accessToken;
        }
        return null;
      } catch {
        return null;
      }
    },
  },
];

async function findToken(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Searching for Figma OAuth Token");
  console.log("=".repeat(60));
  console.log();

  let foundToken = false;

  for (const location of tokenLocations) {
    try {
      console.log(`Checking: ${location.name}`);
      console.log(`Path: ${location.path}`);

      const content = await fs.readFile(location.path, "utf-8");
      const token = location.parser(content);

      if (token) {
        console.log("✓ Token found!");
        console.log();
        console.log("Token preview:", token.substring(0, 20) + "...");
        console.log();
        console.log("To use this token, create ~/.figma/mcp-token.json:");
        console.log();
        console.log(
          JSON.stringify(
            {
              accessToken: token,
              tokenType: "Bearer",
              expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            },
            null,
            2,
          ),
        );
        console.log();
        foundToken = true;
        break;
      } else {
        console.log("✗ No token found in this location");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.log("✗ File not found");
      } else {
        console.log("✗ Error reading file:", (error as Error).message);
      }
    }
    console.log();
  }

  if (!foundToken) {
    console.log("=".repeat(60));
    console.log("No Figma token found in common locations");
    console.log("=".repeat(60));
    console.log();
    console.log("Options:");
    console.log("1. Install Claude Code and authenticate with Figma");
    console.log("2. Install Cursor and authenticate with Figma");
    console.log("3. Manually create token file at ~/.figma/mcp-token.json");
    console.log();
    console.log("For manual setup, see: npm run auth:figma");
  }
}

findToken().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
