// Test the updated get_screenshot tool that saves to disk
import { FigmaService } from '../src/services/figma.js';
import { getScreenshotTool } from '../src/mcp/tools/get-screenshot-tool.js';

const figmaService = new FigmaService({
  figmaApiKey: 'YOUR_FIGMA_API_KEY',
  figmaOAuthToken: '',
  useOAuth: false
});

console.log('Testing updated get_screenshot tool (saves to disk)...');
console.log('');

try {
  const result = await getScreenshotTool.handler(
    {
      fileKey: 'Bd8jkoiKWDlWyHU61tUugI',
      nodeId: '4309-1687'
    },
    figmaService
  );

  console.log('✅ Tool executed successfully!');
  console.log('');
  console.log('Result:', JSON.stringify(result, null, 2));
  
} catch (error) {
  console.error('❌ ERROR:', error);
}