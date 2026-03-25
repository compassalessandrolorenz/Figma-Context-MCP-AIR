// Test the full get_screenshot tool
import { FigmaService } from '../src/services/figma.js';
import { getScreenshotTool } from '../src/mcp/tools/get-screenshot-tool.js';

const figmaService = new FigmaService({
  figmaApiKey: 'YOUR_FIGMA_API_KEY',
  figmaOAuthToken: '',
  useOAuth: false
});

console.log('Testing get_screenshot tool...');
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
  console.log('Result structure:');
  console.log('- isError:', 'isError' in result ? result.isError : 'not present');
  console.log('- content length:', result.content?.length);
  console.log('');
  
  if (result.content && result.content.length > 0) {
    const firstContent = result.content[0];
    console.log('First content item:');
    console.log('- type:', firstContent.type);
    
    if ('data' in firstContent) {
      const data = (firstContent as any).data;
      console.log('- data length:', data.length);
      console.log('- data starts with:', data.substring(0, 50));
      console.log('- contains whitespace?', /\s/.test(data));
      console.log('- valid base64?', /^[A-Za-z0-9+/]*={0,2}$/.test(data));
    }
    
    if ('mimeType' in firstContent) {
      console.log('- mimeType:', (firstContent as any).mimeType);
    }
  }
  
  console.log('');
  console.log('Full result:', JSON.stringify(result, null, 2).substring(0, 500));
  
} catch (error) {
  console.error('❌ ERROR:', error);
}