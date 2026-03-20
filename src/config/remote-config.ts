import { z } from "zod";

/**
 * Configuration schema for Figma Remote MCP connection
 */
export const RemoteMCPConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().url().default("https://mcp.figma.com/mcp"),
  transport: z.enum(["sse"]).default("sse"),
  timeout: z.number().positive().default(30000),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().positive().default(1000),
});

export type RemoteMCPConfig = z.infer<typeof RemoteMCPConfigSchema>;

/**
 * Load remote MCP configuration from environment variables
 */
export function loadRemoteConfig(): RemoteMCPConfig {
  const config = {
    enabled: process.env.FIGMA_REMOTE_MCP_ENABLED === "true",
    endpoint: process.env.FIGMA_REMOTE_MCP_ENDPOINT || "https://mcp.figma.com/mcp",
    transport: "sse" as const,
    timeout: parseInt(process.env.FIGMA_REMOTE_TIMEOUT || "30000", 10),
    retryAttempts: parseInt(process.env.FIGMA_REMOTE_RETRY || "3", 10),
    retryDelay: parseInt(process.env.FIGMA_REMOTE_RETRY_DELAY || "1000", 10),
  };

  return RemoteMCPConfigSchema.parse(config);
}

/**
 * Validate remote configuration
 */
export function validateRemoteConfig(config: RemoteMCPConfig): void {
  if (config.enabled && !config.endpoint) {
    throw new Error("FIGMA_REMOTE_MCP_ENDPOINT is required when remote MCP is enabled");
  }
}
