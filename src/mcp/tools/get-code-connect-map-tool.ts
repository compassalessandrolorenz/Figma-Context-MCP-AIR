/**
 * get_code_connect_map Tool
 *
 * Retrieves a mapping between Figma node IDs and their corresponding code components.
 *
 * **IMPORTANT NOTE**: Figma's REST API does not provide a public endpoint to READ Code Connect mappings.
 * The API only supports uploading mappings via POST /code_connect. This tool will attempt to retrieve
 * mappings but will likely return an empty object unless Figma adds read support in the future.
 *
 * Returns a JSON object mapping node IDs to code component information.
 * AI agents use this to find which code component corresponds to each Figma node.
 *
 * Requires: Figma Organization or Enterprise plan
 */

import { z } from "zod";
import type { FigmaService } from "../../services/figma.js";
import {
  checkEnterprisePlan,
  isEnterpriseRequiredError,
  createEnterpriseRequiredError,
} from "../../utils/code-connect-helpers.js";
import { Logger } from "../../utils/logger.js";

export const getCodeConnectMapParametersSchema = z.object({
  fileKey: z.string().describe("The Figma file key (from the file URL)"),
});

export type GetCodeConnectMapParams = z.infer<typeof getCodeConnectMapParametersSchema>;

export async function getCodeConnectMapHandler(
  params: GetCodeConnectMapParams,
  figmaService: FigmaService,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    // Check Enterprise plan requirement
    await checkEnterprisePlan(figmaService);

    Logger.log(`Fetching Code Connect mappings for file: ${params.fileKey}`);
    Logger.log(
      `NOTE: Figma's REST API does not provide a public read endpoint for Code Connect mappings`,
    );

    // Attempt to get existing mappings (will likely return empty)
    const mappings = await figmaService.getCodeConnectMappings(params.fileKey);

    // Return JSON object directly
    const output = JSON.stringify(mappings, null, 2);

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

    // If it's a different error, return empty object
    Logger.log(`Error fetching Code Connect mappings: ${error}`);
    Logger.log(`This is expected - Figma does not provide a public read endpoint for Code Connect`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({}, null, 2),
        },
      ],
    };
  }
}

export const getCodeConnectMapTool = {
  name: "get_code_connect_map",
  description:
    "Attempts to retrieve a mapping between Figma node IDs and their corresponding code components. " +
    "Returns a JSON object with format: { [nodeId]: { codeConnectSrc: string, codeConnectName: string } }. " +
    "NOTE: Figma's REST API does not currently provide a public endpoint to READ Code Connect mappings. " +
    "This tool will likely return an empty object. Mappings can only be uploaded via add_code_connect_map. " +
    "Requires Organization or Enterprise plan.",
  parametersSchema: getCodeConnectMapParametersSchema,
  handler: getCodeConnectMapHandler,
};
