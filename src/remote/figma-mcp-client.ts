import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { OAuthTokenManager } from "./oauth-manager.js";
import type { RemoteMCPConfig } from "../config/remote-config.js";

export interface FigmaRemoteMCPClientOptions {
  config: RemoteMCPConfig;
  tokenManager: OAuthTokenManager;
}

export class FigmaRemoteMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private config: RemoteMCPConfig;
  private tokenManager: OAuthTokenManager;
  private connected: boolean = false;

  constructor(options: FigmaRemoteMCPClientOptions) {
    this.config = options.config;
    this.tokenManager = options.tokenManager;
  }

  /**
   * Connect to Figma's remote MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log("Already connected to Figma remote MCP server");
      return;
    }

    // Load OAuth token
    const token = await this.tokenManager.loadToken();
    if (!token) {
      throw new Error("No OAuth token found. Please authenticate first using: npm run auth:figma");
    }

    console.log("Connecting to Figma remote MCP server...");
    console.log(`Endpoint: ${this.config.endpoint}`);

    try {
      // Create SSE transport with authentication
      this.transport = new SSEClientTransport(new URL(this.config.endpoint));

      // Note: SSEClientTransport doesn't support custom headers in constructor
      // Authentication will be handled via URL parameters or connection handshake
      // TODO: Investigate Figma's authentication mechanism for SSE transport

      // Create MCP client
      this.client = new Client(
        {
          name: "figma-local-mcp-bridge",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // Connect to remote server
      await this.client.connect(this.transport);
      this.connected = true;

      console.log("✓ Connected to Figma remote MCP server");
    } catch (error) {
      this.connected = false;
      console.error("Failed to connect to Figma remote MCP server:", error);
      throw new Error(`Failed to connect to Figma remote MCP server: ${(error as Error).message}`);
    }
  }

  /**
   * List available tools from remote server
   */
  async listTools(): Promise<Tool[]> {
    if (!this.client || !this.connected) {
      throw new Error("Not connected to remote server. Call connect() first.");
    }

    try {
      const result = await this.client.request(
        {
          method: "tools/list",
        },
        ListToolsResultSchema,
      );

      return result.tools;
    } catch (error) {
      console.error("Failed to list tools from remote server:", error);
      throw error;
    }
  }

  /**
   * Call a tool on the remote server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error("Not connected to remote server. Call connect() first.");
    }

    try {
      const result = await this.client.request(
        {
          method: "tools/call",
          params: {
            name,
            arguments: args,
          },
        },
        CallToolResultSchema,
      );

      return result;
    } catch (error) {
      console.error(`Failed to call tool '${name}' on remote server:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from remote server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      try {
        await this.client.close();
        console.log("Disconnected from Figma remote MCP server");
      } catch (error) {
        console.error("Error disconnecting from remote server:", error);
      } finally {
        this.connected = false;
        this.client = null;
        this.transport = null;
      }
    }
  }

  /**
   * Check if connected to remote server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get remote server endpoint
   */
  getEndpoint(): string {
    return this.config.endpoint;
  }
}
