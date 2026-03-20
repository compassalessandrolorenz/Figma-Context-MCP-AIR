/**
 * add_code_connect_map Tool
 *
 * Convenience tool to add a single Code Connect mapping.
 * This is a wrapper around send_code_connect_mappings for single mappings.
 *
 * Requires: Figma Organization or Enterprise plan
 */

import { z } from "zod";
import type { FigmaService } from "../../services/figma.js";
import { sendCodeConnectMappingsHandler } from "./send-code-connect-mappings-tool.js";

export const addCodeConnectMapParametersSchema = z.object({
  fileKey: z.string().describe("The Figma file key (from the file URL)"),
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

export type AddCodeConnectMapParams = z.infer<typeof addCodeConnectMapParametersSchema>;

export async function addCodeConnectMapHandler(
  params: AddCodeConnectMapParams,
  figmaService: FigmaService,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // Delegate to send_code_connect_mappings with a single mapping
  const { fileKey, ...mapping } = params;

  return sendCodeConnectMappingsHandler(
    {
      fileKey,
      mappings: [mapping],
    },
    figmaService,
  );
}

export const addCodeConnectMapTool = {
  name: "add_code_connect_map",
  description:
    "Add a single Code Connect mapping to link a Figma component to code. " +
    "The mapping will be visible in Figma Dev Mode. " +
    "For multiple mappings, use send_code_connect_mappings instead. " +
    "Requires Organization or Enterprise plan.",
  parametersSchema: addCodeConnectMapParametersSchema,
  handler: addCodeConnectMapHandler,
};
