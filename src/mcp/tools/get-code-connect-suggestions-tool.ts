/**
 * get_code_connect_suggestions Tool
 *
 * Scans a Figma file for published components that don't have Code Connect mappings yet.
 * Returns component information including properties, thumbnails, and Figma URLs.
 *
 * Requires: Figma Organization or Enterprise plan
 */

import { z } from "zod";
import type { FigmaService } from "../../services/figma.js";
import {
  checkEnterprisePlan,
  isEnterpriseRequiredError,
  createEnterpriseRequiredError,
  type ComponentInfo,
} from "../../utils/code-connect-helpers.js";
import { Logger } from "../../utils/logger.js";

export const getCodeConnectSuggestionsParametersSchema = z.object({
  fileKey: z.string().describe("The Figma file key (from the file URL)"),
  nodeId: z
    .string()
    .optional()
    .describe("Optional: Limit suggestions to components within this frame"),
});

export type GetCodeConnectSuggestionsParams = z.infer<
  typeof getCodeConnectSuggestionsParametersSchema
>;

export async function getCodeConnectSuggestionsHandler(
  params: GetCodeConnectSuggestionsParams,
  figmaService: FigmaService,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    // Check Enterprise plan requirement (logs warning, actual check happens on API call)
    await checkEnterprisePlan(figmaService);

    Logger.log(`Fetching Code Connect suggestions for file: ${params.fileKey}`);

    // Get all published components in the file
    const componentsResponse = await figmaService.getComponents(params.fileKey);
    const components: ComponentInfo[] = componentsResponse.meta?.components || [];

    if (components.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No published components found in this file. Components must be published to use Code Connect.",
          },
        ],
      };
    }

    Logger.log(`Found ${components.length} published component(s)`);

    // Try to get existing mappings (may not be available)
    const existingMappings = await figmaService.getCodeConnectMappings(params.fileKey);
    // existingMappings is now an object: { [nodeId]: { codeConnectSrc, codeConnectName } }
    const mappedNodeIds = new Set(Object.keys(existingMappings));

    Logger.log(`Found ${mappedNodeIds.size} existing mapping(s)`);

    // Filter out components that already have mappings
    let unmappedComponents = components.filter(
      (component) => !mappedNodeIds.has(component.node_id),
    );

    // If nodeId filter is provided, filter to descendants
    if (params.nodeId) {
      const normalizedNodeId = params.nodeId.replace(/-/g, ":");
      // Note: We can't easily determine component hierarchy without fetching the full file
      // For now, we'll just filter by containing_frame if available
      unmappedComponents = unmappedComponents.filter((component) => {
        if (component.containing_frame?.nodeId) {
          return component.containing_frame.nodeId === normalizedNodeId;
        }
        return true; // Include if we can't determine hierarchy
      });
    }

    if (unmappedComponents.length === 0) {
      return {
        content: [
          {
            type: "text",
            text:
              mappedNodeIds.size > 0
                ? "All components in this file already have Code Connect mappings."
                : "No unmapped components found matching the specified criteria.",
          },
        ],
      };
    }

    // Format suggestions
    const suggestions = unmappedComponents.map((component) => {
      const figmaUrl = `https://www.figma.com/file/${params.fileKey}?node-id=${component.node_id.replace(/:/g, "-")}`;

      return {
        nodeId: component.node_id,
        name: component.name,
        description: component.description || "",
        figmaUrl,
        thumbnailUrl: component.thumbnail_url || "",
        containingFrame: component.containing_frame?.name || "Root",
      };
    });

    // Format output as YAML
    const output = [
      "# Code Connect Suggestions",
      "",
      `Found ${suggestions.length} component(s) without Code Connect mappings:`,
      "",
      ...suggestions
        .map((suggestion, index) =>
          [
            `## ${index + 1}. ${suggestion.name}`,
            "",
            `- **Node ID**: \`${suggestion.nodeId}\``,
            `- **Figma URL**: ${suggestion.figmaUrl}`,
            `- **Containing Frame**: ${suggestion.containingFrame}`,
            suggestion.description && `- **Description**: ${suggestion.description}`,
            suggestion.thumbnailUrl && `- **Thumbnail**: ${suggestion.thumbnailUrl}`,
            "",
          ].filter(Boolean),
        )
        .flat(),
      "---",
      "",
      "## Next Steps",
      "",
      "1. Use `add_code_connect_map` to create a mapping for a component",
      "2. Or use `send_code_connect_mappings` to upload multiple mappings at once",
      "",
      "### Example:",
      "```typescript",
      "await mcp.call('add_code_connect_map', {",
      `  fileKey: '${params.fileKey}',`,
      `  nodeId: '${suggestions[0]?.nodeId || "1:234"}',`,
      `  component: '${suggestions[0]?.name || "Button"}',`,
      "  template: '<Button variant={variant}>{children}</Button>',",
      "  language: 'typescript',",
      "  label: 'React'",
      "});",
      "```",
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  } catch (error) {
    // Check if this is an Enterprise plan requirement error
    if (isEnterpriseRequiredError(error)) {
      throw createEnterpriseRequiredError(error);
    }

    throw error;
  }
}

export const getCodeConnectSuggestionsTool = {
  name: "get_code_connect_suggestions",
  description:
    "Scan a Figma file for published components that don't have Code Connect mappings yet. " +
    "Returns component information to help you create code mappings. " +
    "Requires Organization or Enterprise plan.",
  parametersSchema: getCodeConnectSuggestionsParametersSchema,
  handler: getCodeConnectSuggestionsHandler,
};
