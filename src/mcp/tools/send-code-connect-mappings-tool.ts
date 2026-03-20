/**
 * send_code_connect_mappings Tool
 *
 * Upload multiple Code Connect mappings to Figma at once.
 * This is the primary tool for creating code-to-design mappings.
 *
 * Requires: Figma Organization or Enterprise plan
 */

import { z } from "zod";
import type { FigmaService } from "../../services/figma.js";
import {
  checkEnterprisePlan,
  isEnterpriseRequiredError,
  createEnterpriseRequiredError,
  convertToCodeConnectJSON,
  type CodeConnectJSON,
} from "../../utils/code-connect-helpers.js";
import { Logger } from "../../utils/logger.js";

const mappingSchema = z.object({
  nodeId: z.string().describe('The Figma node ID (e.g., "1:234" or "1-234")'),
  component: z.string().describe('The component name (e.g., "Button")'),
  template: z.string().describe("The code template/example"),
  language: z.string().describe('Programming language (e.g., "typescript", "javascript", "tsx")'),
  label: z.string().describe('Display label (e.g., "React", "Vue", "Web Component")'),
  variant: z.record(z.any()).optional().describe('Variant filter (e.g., {"Type": "Primary"})'),
  props: z.record(z.any()).optional().describe("Prop mappings"),
  links: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
      }),
    )
    .optional()
    .describe("Documentation links"),
  source: z.string().optional().describe("Source file path"),
});

export const sendCodeConnectMappingsParametersSchema = z.object({
  fileKey: z.string().describe("The Figma file key (from the file URL)"),
  mappings: z.array(mappingSchema).describe("Array of Code Connect mappings to upload"),
});

export type SendCodeConnectMappingsParams = z.infer<typeof sendCodeConnectMappingsParametersSchema>;

export async function sendCodeConnectMappingsHandler(
  params: SendCodeConnectMappingsParams,
  figmaService: FigmaService,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    // Check Enterprise plan requirement
    await checkEnterprisePlan(figmaService);

    if (params.mappings.length === 0) {
      throw new Error("No mappings provided. Please provide at least one mapping.");
    }

    Logger.log(`Uploading ${params.mappings.length} Code Connect mapping(s) to Figma`);

    // Convert mappings to CodeConnectJSON format
    const docs: CodeConnectJSON[] = params.mappings.map((mapping) =>
      convertToCodeConnectJSON(params.fileKey, mapping),
    );

    // Upload to Figma
    const response = await figmaService.uploadCodeConnect(docs);

    // Parse response
    const publishedNodes = response.meta?.published_nodes || [];
    const failedNodes = response.meta?.failed_nodes || [];

    // Format success message
    const successLines: string[] = [];
    const failureLines: string[] = [];

    if (publishedNodes.length > 0) {
      successLines.push("## ✅ Successfully Uploaded", "");
      publishedNodes.forEach((node: any, index: number) => {
        const mapping = params.mappings.find((m) =>
          node.figmaNode.includes(m.nodeId.replace(/:/g, "-")),
        );
        successLines.push(
          `${index + 1}. **${mapping?.component || "Component"}** (${mapping?.label || "Unknown"})`,
          `   - Node: \`${mapping?.nodeId}\``,
          `   - URL: ${node.figmaNode}`,
          "",
        );
      });
    }

    if (failedNodes.length > 0) {
      failureLines.push("## ❌ Failed to Upload", "");
      failedNodes.forEach((node: any, index: number) => {
        const mapping = params.mappings.find((m) =>
          node.figmaNode.includes(m.nodeId.replace(/:/g, "-")),
        );
        failureLines.push(
          `${index + 1}. **${mapping?.component || "Component"}**`,
          `   - Node: \`${mapping?.nodeId}\``,
          `   - Reason: ${node.reason}`,
          "",
        );
      });
    }

    const output = [
      "# Code Connect Upload Results",
      "",
      `Uploaded ${params.mappings.length} mapping(s) to Figma file \`${params.fileKey}\``,
      "",
      ...successLines,
      ...failureLines,
      "---",
      "",
      "## Next Steps",
      "",
      "1. Open the Figma file in Dev Mode to see your code examples",
      "2. Verify that the mappings display correctly",
      "3. Use `get_code_connect_suggestions` to find more components to map",
      "",
      publishedNodes.length > 0 && "**Tip**: Your code examples are now visible in Figma Dev Mode!",
    ]
      .filter(Boolean)
      .join("\n");

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

    // Provide helpful error context
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to upload Code Connect mappings: ${errorMessage}\n\n` +
        "Common issues:\n" +
        "- Ensure you have Organization or Enterprise plan\n" +
        "- Verify the file key is correct\n" +
        "- Check that node IDs exist in the file\n" +
        "- Ensure components are published\n" +
        "- Verify your Figma access token has write permissions",
    );
  }
}

export const sendCodeConnectMappingsTool = {
  name: "send_code_connect_mappings",
  description:
    "Upload multiple Code Connect mappings to Figma. Maps Figma components to code examples. " +
    "The mappings will be visible in Figma Dev Mode. " +
    "Requires Organization or Enterprise plan.",
  parametersSchema: sendCodeConnectMappingsParametersSchema,
  handler: sendCodeConnectMappingsHandler,
};
