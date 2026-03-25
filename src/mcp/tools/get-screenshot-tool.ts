import { z } from "zod";
import { FigmaService } from "~/services/figma.js";
import { Logger } from "~/utils/logger.js";
import fs from "fs";
import path from "path";

const parameters = {
  fileKey: z
    .string()
    .regex(/^[a-zA-Z0-9]+$/, "File key must be alphanumeric")
    .describe(
      "The key of the Figma file containing the node, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
    ),
  nodeId: z
    .string()
    .regex(/^I?\d+[:|-]\d+$/, "Node ID must be like '1234:5678' or 'I5666:180910'")
    .describe(
      "The ID of the node to capture as a screenshot, often found as URL parameter node-id=<nodeId>. Use format '1234:5678'.",
    ),
  outputPath: z
    .string()
    .optional()
    .describe(
      "Optional: Directory path where the screenshot will be saved. Defaults to './screenshots' in the current workspace.",
    ),
  fileName: z
    .string()
    .optional()
    .describe(
      "Optional: Custom filename for the screenshot (without extension). Defaults to 'screenshot-{nodeId}.png'.",
    ),
};

const parametersSchema = z.object(parameters);
export type GetScreenshotParams = z.infer<typeof parametersSchema>;

async function getScreenshot(params: GetScreenshotParams, figmaService: FigmaService) {
  try {
    const { fileKey, nodeId: rawNodeId, outputPath, fileName } = parametersSchema.parse(params);

    // Replace - with : in nodeId for our query—Figma API expects :
    const nodeId = rawNodeId.replace(/-/g, ":");

    Logger.log(`Fetching screenshot for node ${nodeId} from file ${fileKey}`);

    // Get base64 image data from service
    const base64Image = await figmaService.getScreenshotBase64(fileKey, nodeId);

    // Validate base64 data
    if (!base64Image || base64Image.length === 0) {
      throw new Error("Received empty base64 data from Figma service");
    }

    // Determine output directory and filename
    const outputDir = outputPath || path.join(process.cwd(), "screenshots");
    const sanitizedNodeId = nodeId.replace(/:/g, "-");
    const finalFileName = fileName ? `${fileName}.png` : `screenshot-${sanitizedNodeId}.png`;
    const fullPath = path.join(outputDir, finalFileName);

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      Logger.log(`Created directory: ${outputDir}`);
    }

    // Convert base64 to buffer and save to file
    const imageBuffer = Buffer.from(base64Image, "base64");
    fs.writeFileSync(fullPath, imageBuffer);

    const sizeKB = (imageBuffer.length / 1024).toFixed(2);
    Logger.log(`Successfully saved screenshot to ${fullPath} (${sizeKB} KB)`);

    // Return text response with file path (like download_figma_images does)
    return {
      content: [
        {
          type: "text" as const,
          text: `Screenshot saved successfully!\n\nFile: ${finalFileName}\nPath: ${fullPath}\nSize: ${sizeKB} KB\nNode: ${nodeId}\n\nThe screenshot is now available for analysis.`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    Logger.error(`Error fetching screenshot for node ${params.nodeId}:`, message);

    // Provide actionable error information based on error type
    let errorDetails = `Error fetching screenshot: ${message}`;

    if (message.includes("No render URL")) {
      errorDetails += `

Troubleshooting:
- Verify the node ID is correct (format: '1234:5678' or 'I5666:180910')
- Ensure the node exists in the specified file
- Check that the node is visible and renderable (not hidden or deleted)
- Confirm you have access to view this file`;
    } else if (message.includes("timed out")) {
      errorDetails += `

Troubleshooting:
- The screenshot may be too large or complex
- Try selecting a smaller node or component
- Check your network connection to Figma's CDN
- Retry the operation`;
    } else if (
      message.includes("authentication") ||
      message.includes("403") ||
      message.includes("401")
    ) {
      errorDetails += `

Troubleshooting:
- Verify your Figma API token is valid and not expired
- Ensure you have access to this file (check file permissions)
- Confirm the file is not in a restricted team`;
    } else if (message.includes("404") || message.includes("not found")) {
      errorDetails += `

Troubleshooting:
- Verify the file key is correct
- Ensure the file hasn't been deleted or moved
- Check that you're using the correct Figma account`;
    }

    return {
      isError: true,
      content: [{ type: "text" as const, text: errorDetails }],
    };
  }
}

export const getScreenshotTool = {
  name: "get_screenshot",
  description:
    "Capture and save a visual screenshot (PNG image) of a specific Figma node to disk. The screenshot is saved to a local directory where it can be analyzed. Useful for verifying visual appearance, checking design implementation accuracy, or understanding complex visual elements. The screenshot is rendered at 2x scale for high quality. Returns the file path where the screenshot was saved.",
  parametersSchema,
  handler: getScreenshot,
} as const;
