#!/usr/bin/env node
import { loadRemoteConfig, validateRemoteConfig } from "../config/remote-config.js";
import { FigmaRemoteMCPClient, OAuthTokenManager } from "../remote/index.js";

/**
 * Test script to verify connection to Figma's remote MCP server
 */
async function testConnection() {
  console.log("=".repeat(60));
  console.log("Testing Figma Remote MCP Connection");
  console.log("=".repeat(60));
  console.log();

  try {
    // Load configuration
    console.log("1. Loading configuration...");
    const config = loadRemoteConfig();
    console.log(`   Enabled: ${config.enabled}`);
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log();

    if (!config.enabled) {
      console.log("❌ Remote MCP is not enabled");
      console.log("   Set FIGMA_REMOTE_MCP_ENABLED=true to enable");
      process.exit(1);
    }

    validateRemoteConfig(config);
    console.log("✓ Configuration valid");
    console.log();

    // Check token
    console.log("2. Checking OAuth token...");
    const tokenManager = new OAuthTokenManager();
    const hasToken = await tokenManager.hasValidToken();

    if (!hasToken) {
      console.log("❌ No valid OAuth token found");
      console.log("   Run: npm run find:token");
      process.exit(1);
    }

    const token = await tokenManager.loadToken();
    console.log(`✓ Token found: ${token!.accessToken.substring(0, 20)}...`);
    console.log();

    // Connect to remote server
    console.log("3. Connecting to Figma remote MCP server...");
    const client = new FigmaRemoteMCPClient({ config, tokenManager });

    await client.connect();
    console.log("✓ Connected successfully!");
    console.log();

    // List available tools
    console.log("4. Listing available tools...");
    const tools = await client.listTools();
    console.log(`✓ Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Check for generate_figma_design
    const generateTool = tools.find((t) => t.name === "generate_figma_design");
    if (generateTool) {
      console.log("✓ generate_figma_design tool is available!");
      console.log(`   Description: ${generateTool.description}`);
      console.log(`   Input schema:`, JSON.stringify(generateTool.inputSchema, null, 2));
    } else {
      console.log("⚠️  generate_figma_design tool not found");
    }
    console.log();

    // Disconnect
    await client.disconnect();
    console.log("✓ Disconnected successfully");
    console.log();

    console.log("=".repeat(60));
    console.log("✅ All tests passed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error();
    console.error("=".repeat(60));
    console.error("❌ Test failed");
    console.error("=".repeat(60));
    console.error();
    console.error("Error:", (error as Error).message);
    console.error();
    console.error("Stack trace:");
    console.error((error as Error).stack);
    process.exit(1);
  }
}

testConnection();
