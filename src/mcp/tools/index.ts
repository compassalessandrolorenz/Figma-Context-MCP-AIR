// Existing tools
export { getFigmaDataTool } from "./get-figma-data-tool.js";
export { downloadFigmaImagesTool } from "./download-figma-images-tool.js";
export type { DownloadImagesParams } from "./download-figma-images-tool.js";
export type { GetFigmaDataParams } from "./get-figma-data-tool.js";

// Phase 1 tools
export { whoamiTool } from "./whoami-tool.js";
export { getDesignContextTool } from "./get-design-context-tool.js";
export { getScreenshotTool } from "./get-screenshot-tool.js";
export { getVariableDefsTool } from "./get-variable-defs-tool.js";
export { createDesignSystemRulesTool } from "./create-design-system-rules-tool.js";
export { getMetadataTool } from "./get-metadata-tool.js";

// Phase 1 types
export type { WhoamiParams } from "./whoami-tool.js";
export type { GetDesignContextParams } from "./get-design-context-tool.js";
export type { GetScreenshotParams } from "./get-screenshot-tool.js";
export type { GetVariableDefsParams } from "./get-variable-defs-tool.js";
export type { CreateDesignSystemRulesParams } from "./create-design-system-rules-tool.js";
export type { GetMetadataParams } from "./get-metadata-tool.js";

// Phase 2 tools
export { getFigJamTool } from "./get-figjam-tool.js";

// Phase 2 types

// Phase 3 tools (Code Connect - Enterprise only)
export { getCodeConnectSuggestionsTool } from "./get-code-connect-suggestions-tool.js";
export { getCodeConnectMapTool } from "./get-code-connect-map-tool.js";
export { sendCodeConnectMappingsTool } from "./send-code-connect-mappings-tool.js";
export { addCodeConnectMapTool } from "./add-code-connect-map-tool.js";

// Phase 3 types
export type { GetCodeConnectSuggestionsParams } from "./get-code-connect-suggestions-tool.js";
export type { GetCodeConnectMapParams } from "./get-code-connect-map-tool.js";
export type { SendCodeConnectMappingsParams } from "./send-code-connect-mappings-tool.js";
export type { AddCodeConnectMapParams } from "./add-code-connect-map-tool.js";
export type { GetFigJamParams } from "./get-figjam-tool.js";
