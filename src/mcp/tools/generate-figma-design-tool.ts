import { z } from "zod";
import type { FigmaRemoteMCPClient } from "../../remote/index.js";

/**
 * Input schema for generate_figma_design tool
 * This will be synchronized with the remote server's schema
 */
export const GenerateFigmaDesignArgsSchema = z
  .object({
    // Schema will be fetched from remote server
    // Placeholder for now - actual schema will be discovered at runtime
    html: z.string().optional(),
    url: z.string().url().optional(),
    target: z.enum(["new_file", "existing_file", "clipboard"]).optional(),
    fileKey: z.string().optional(),
  })
  .passthrough(); // Allow additional properties from remote schema

export type GenerateFigmaDesignArgs = z.infer<typeof GenerateFigmaDesignArgsSchema>;

export class GenerateFigmaDesignProxy {
  private remoteClient: FigmaRemoteMCPClient;
  private toolSchema: unknown = null;

  constructor(remoteClient: FigmaRemoteMCPClient) {
    this.remoteClient = remoteClient;
  }

  /**
   * Fetch and cache tool schema from remote server
   */
  async getToolSchema(): Promise<unknown> {
    if (this.toolSchema) {
      return this.toolSchema;
    }

    if (!this.remoteClient.isConnected()) {
      throw new Error("Remote client not connected");
    }

    const tools = await this.remoteClient.listTools();
    const generateTool = tools.find((t) => t.name === "generate_figma_design");

    if (!generateTool) {
      throw new Error("generate_figma_design tool not available on Figma remote MCP server");
    }

    this.toolSchema = generateTool.inputSchema;
    return this.toolSchema;
  }

  /**
   * Execute the tool by proxying to remote server
   */
  async execute(args: GenerateFigmaDesignArgs): Promise<unknown> {
    if (!this.remoteClient.isConnected()) {
      throw new Error("Remote client not connected. Enable with FIGMA_REMOTE_MCP_ENABLED=true");
    }

    console.log("Proxying generate_figma_design request to Figma remote MCP server...");

    try {
      const result = await this.executeWithRetry(args);

      // Add metadata to indicate this was proxied
      if (typeof result === "object" && result !== null) {
        return {
          ...result,
          _metadata: {
            proxied: true,
            remote_server: "figma-official",
            endpoint: this.remoteClient.getEndpoint(),
          },
        };
      }

      // If result is not an object, return it as-is
      return result;
    } catch (error) {
      console.error("Failed to execute generate_figma_design:", error);
      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    args: GenerateFigmaDesignArgs,
    maxRetries: number = 3,
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.remoteClient.callTool("generate_figma_design", args);
      } catch (error) {
        lastError = error as Error;

        if (this.isRetryable(error)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await this.delay(delay);
          continue;
        }

        // Non-retryable error, throw immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: unknown): boolean {
    const err = error as { code?: string; status?: number };

    // Network errors
    if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
      return true;
    }

    // 5xx server errors
    if (err.status !== undefined && err.status >= 500 && err.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
