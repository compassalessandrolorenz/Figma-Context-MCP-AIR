/**
 * Code Connect Helper Utilities
 *
 * Shared utilities for Code Connect tools (Enterprise only)
 */

import type { FigmaService } from "../services/figma.js";
import { Logger } from "./logger.js";

/**
 * Check if user has Enterprise or Organization plan required for Code Connect
 *
 * Note: The Figma REST API /me endpoint does not include plan information.
 * This function will attempt to use Code Connect features and catch permission errors.
 * A proper plan check would require additional API calls or Enterprise-specific endpoints.
 *
 * @throws Error with helpful message about Enterprise requirement
 */
export async function checkEnterprisePlan(figmaService: FigmaService): Promise<void> {
  // Verify authentication works
  const user = await figmaService.getMe();

  // Note: We cannot directly check the plan via /me endpoint
  // The actual plan validation will happen when attempting to use Code Connect endpoints
  // If the user doesn't have Enterprise/Org plan, the API will return 403 Forbidden

  Logger.log(`Authenticated as: ${user.handle} (${user.email})`);
  Logger.log("Note: Code Connect requires Organization or Enterprise plan");
}

/**
 * Check if an error is a permission/plan error
 */
export function isEnterpriseRequiredError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  const status = error?.status || error?.response?.status;

  return (
    status === 403 ||
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("enterprise") ||
    message.includes("organization")
  );
}

/**
 * Create a helpful error message for Enterprise requirement
 */
export function createEnterpriseRequiredError(originalError?: any): Error {
  const baseMessage =
    "Code Connect requires a Figma Organization or Enterprise plan. " +
    "Learn more: https://www.figma.com/pricing";

  if (originalError) {
    return new Error(`${baseMessage}\n\nOriginal error: ${originalError.message || originalError}`);
  }

  return new Error(baseMessage);
}

/**
 * Code Connect JSON format based on @figma/code-connect package
 */
export interface CodeConnectJSON {
  figmaNode: string;
  component?: string;
  variant?: Record<string, any>;
  template: string;
  templateData: {
    props?: Record<string, any>;
    imports?: string[];
    nestable?: boolean;
    isParserless?: boolean;
  };
  language: string;
  label: string;
  links?: Array<{
    name: string;
    url: string;
  }>;
  source?: string;
  sourceLocation?: {
    line: number;
  };
  metadata: {
    cliVersion: string;
  };
}

/**
 * Convert tool parameters to CodeConnectJSON format
 */
export function convertToCodeConnectJSON(
  fileKey: string,
  mapping: {
    nodeId: string;
    component: string;
    template: string;
    language: string;
    label: string;
    variant?: Record<string, any>;
    props?: Record<string, any>;
    links?: Array<{ name: string; url: string }>;
    source?: string;
  },
): CodeConnectJSON {
  // Convert node ID format: 1-234 -> 1:234 for internal use
  const normalizedNodeId = mapping.nodeId.replace(/-/g, ":");
  // URL-encode the colon for the Figma URL (1:234 -> 1%3A234)
  const urlEncodedNodeId = normalizedNodeId.replace(/:/g, "%3A");

  // Build the result object
  const result: CodeConnectJSON = {
    figmaNode: `https://www.figma.com/design/${fileKey}?node-id=${urlEncodedNodeId}`,
    component: mapping.component,
    template: mapping.template,
    templateData: {
      imports: extractImports(mapping.template),
    },
    language: mapping.language,
    label: mapping.label,
    source: mapping.source || "mcp-generated", // Required by Figma API
    metadata: {
      cliVersion: "1.4.2", // Match @figma/code-connect version
    },
  };

  // Only add optional fields if they are defined
  if (mapping.props) {
    result.templateData.props = mapping.props;
  }

  if (mapping.variant) {
    result.variant = mapping.variant;
  }

  if (mapping.links && mapping.links.length > 0) {
    result.links = mapping.links;
  }

  return result;
}

/**
 * Extract import statements from code template
 */
export function extractImports(template: string): string[] {
  const imports: string[] = [];

  // Match ES6 imports: import ... from '...'
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(template)) !== null) {
    imports.push(match[0]);
  }

  // Match require statements: const ... = require('...')
  const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;

  while ((match = requireRegex.exec(template)) !== null) {
    imports.push(match[0]);
  }

  return imports;
}

/**
 * Upload response format from Figma Code Connect API
 */
export interface UploadResponse {
  meta?: {
    published_nodes?: Array<{
      figmaNode: string;
    }>;
    failed_nodes?: Array<{
      figmaNode: string;
      reason: string;
    }>;
  };
}

/**
 * Component info from Figma REST API
 */
export interface ComponentInfo {
  key: string;
  name: string;
  description: string;
  node_id: string;
  thumbnail_url: string;
  containing_frame?: {
    name: string;
    nodeId: string;
  };
}

/**
 * Extract node ID from Figma URL
 *
 * Converts from URL format to colon format:
 * - URL: https://www.figma.com/design/...?node-id=11%3A11508
 * - Returns: "11:11508"
 *
 * Also handles hyphen format (1-234 -> 1:234)
 */
export function extractNodeIdFromUrl(figmaNodeUrl: string): string | null {
  try {
    const url = new URL(figmaNodeUrl);
    const nodeIdParam = url.searchParams.get("node-id");

    if (!nodeIdParam) {
      return null;
    }

    // Handle URL-encoded colons (%3A) and hyphens
    return nodeIdParam
      .replace(/%3A/gi, ":") // URL-encoded colon
      .replace(/-/g, ":"); // Hyphen format
  } catch {
    Logger.log(`Failed to extract node ID from URL: ${figmaNodeUrl}`);
    return null;
  }
}

/**
 * Format component properties for output
 */
export function formatComponentProperties(component: any): {
  variant?: Array<{ name: string; values: string[] }>;
  boolean?: Array<{ name: string; default: boolean }>;
  text?: Array<{ name: string; default: string }>;
  instanceSwap?: Array<{ name: string; preferredValues: string[] }>;
} {
  const properties: any = {
    variant: [],
    boolean: [],
    text: [],
    instanceSwap: [],
  };

  if (!component.componentPropertyDefinitions) {
    return properties;
  }

  for (const [propName, propDef] of Object.entries(component.componentPropertyDefinitions)) {
    const def = propDef as any;

    switch (def.type) {
      case "VARIANT":
        properties.variant.push({
          name: propName,
          values: def.variantOptions || [],
        });
        break;
      case "BOOLEAN":
        properties.boolean.push({
          name: propName,
          default: def.defaultValue || false,
        });
        break;
      case "TEXT":
        properties.text.push({
          name: propName,
          default: def.defaultValue || "",
        });
        break;
      case "INSTANCE_SWAP":
        properties.instanceSwap.push({
          name: propName,
          preferredValues: (def.preferredValues || []).map((v: any) => v.key),
        });
        break;
    }
  }

  return properties;
}
