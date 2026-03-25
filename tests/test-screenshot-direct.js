// Quick test to see what's happening with the screenshot function
import { FigmaService } from './dist/chunk-Q5OJL6SR.js';

const figmaService = new FigmaService({
  figmaApiKey: 'YOUR_FIGMA_API_KEY',
  figmaOAuthToken: '',
  useOAuth: false
});

console.log('Testing screenshot function...');
console.log('File Key: Bd8jkoiKWDlWyHU61tUugI');
console.log('Node ID: 4309:1687');
console.log('');

try {
  const base64 = await figmaService.getScreenshotBase64('Bd8jkoiKWDlWyHU61tUugI', '4309:1687');
  console.log('✅ SUCCESS!');
  console.log('Base64 length:', base64.length);
  console.log('First 100 chars:', base64.substring(0, 100));
  console.log('Last 100 chars:', base64.substring(base64.length - 100));
  console.log('Contains whitespace?', /\s/.test(base64));
  console.log('Valid base64 format?', /^[A-Za-z0-9+/]*={0,2}$/.test(base64));
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
}