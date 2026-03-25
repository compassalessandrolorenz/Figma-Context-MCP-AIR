# Local Figma MCP Setup Options

You have three ways to use your local repository instead of the marketplace version. Here's a detailed comparison:

---

## Option 1: Build and Use Compiled Version (Recommended for Stability)

### How It Works
- Build TypeScript to JavaScript in `dist/` folder
- Point MCP config directly to the built `dist/bin.js` file
- Most stable approach, similar to production usage

### Steps
1. Install dependencies:
   ```bash
   cd Figma-Context-MCP-Extension
   pnpm install
   ```

2. Build the project:
   ```bash
   pnpm build
   ```

3. Update MCP settings (`mcp_settings.json`):
   ```json
   {
     "mcpServers": {
       "figma-windows-cmd": {
         "command": "node",
         "args": [
           "c:/Users/alessandro.lorenz/Documents/AI-COCKPIT-PROJECTS/FIGMA-MCP/Figma-Context-MCP-Extension/dist/bin.js",
           "--figma-api-key=YOUR_FIGMA_API_KEY",
           "--stdio"
         ],
         "env": {
           "FIGMA_ACCESS_TOKEN": "YOUR_FIGMA_API_KEY"
         },
         "alwaysAllow": [
           "download_figma_images",
           "get_figma_data"
         ]
       }
     }
   }
   ```

### Pros
- ✅ Most stable and production-like
- ✅ Fast execution (pre-compiled)
- ✅ No additional runtime dependencies
- ✅ Easy to debug with source maps

### Cons
- ❌ Must rebuild after every code change (`pnpm build`)
- ❌ Extra step in development workflow

### Best For
- Testing stable changes
- When you're not actively developing
- Production-like environment

---

## Option 2: Development Mode with tsx/ts-node

### How It Works
- Run TypeScript directly without building
- Uses `tsx` (already in devDependencies) to execute `.ts` files
- Changes take effect immediately

### Steps
1. Install dependencies:
   ```bash
   cd Figma-Context-MCP-Extension
   pnpm install
   ```

2. Update MCP settings (`mcp_settings.json`):
   ```json
   {
     "mcpServers": {
       "figma-windows-cmd": {
         "command": "cmd",
         "args": [
           "/c",
           "cd",
           "c:/Users/alessandro.lorenz/Documents/AI-COCKPIT-PROJECTS/FIGMA-MCP/Figma-Context-MCP-Extension",
           "&&",
           "npx",
           "tsx",
           "src/bin.ts",
           "--figma-api-key=YOUR_FIGMA_API_KEY",
           "--stdio"
         ],
         "env": {
           "FIGMA_ACCESS_TOKEN": "YOUR_FIGMA_API_KEY"
         },
         "alwaysAllow": [
           "download_figma_images",
           "get_figma_data"
         ]
       }
     }
   }
   ```

### Pros
- ✅ No build step needed
- ✅ Changes take effect immediately
- ✅ Perfect for active development
- ✅ Can use TypeScript features directly

### Cons
- ❌ Slightly slower startup (TypeScript compilation on-the-fly)
- ❌ Requires tsx runtime
- ❌ More complex command line

### Best For
- Active development and testing
- Rapid iteration on code changes
- Debugging TypeScript directly

---

## Option 3: Local Package Link (Best of Both Worlds)

### How It Works
- Build the project and link it globally
- Use `npx figma-developer-mcp` as before, but it runs your local version
- Combines stability with familiar workflow

### Steps
1. Install dependencies and build:
   ```bash
   cd Figma-Context-MCP-Extension
   pnpm install
   pnpm build
   ```

2. Link the package globally:
   ```bash
   pnpm link --global
   ```

3. Keep existing MCP settings (no changes needed):
   ```json
   {
     "mcpServers": {
       "figma-windows-cmd": {
         "command": "cmd",
         "args": [
           "/c",
           "npx",
           "figma-developer-mcp",
           "--figma-api-key=YOUR_FIGMA_API_KEY",
           "--stdio"
         ],
         "env": {
           "FIGMA_ACCESS_TOKEN": "YOUR_FIGMA_API_KEY"
         },
         "alwaysAllow": [
           "download_figma_images",
           "get_figma_data"
         ]
       }
     }
   }
   ```

4. After making changes, rebuild and the link updates automatically:
   ```bash
   pnpm build
   ```

### Pros
- ✅ No config changes needed
- ✅ Familiar `npx` workflow
- ✅ Easy to switch back to marketplace version (just `pnpm unlink --global`)
- ✅ Works across all projects

### Cons
- ❌ Still requires rebuild after changes
- ❌ Global link can be forgotten
- ❌ Might conflict with marketplace version

### Best For
- Long-term local development
- Testing across multiple projects
- When you want to keep the same workflow

---

## Comparison Table

| Feature | Option 1: Direct Build | Option 2: tsx Runtime | Option 3: Global Link |
|---------|----------------------|---------------------|---------------------|
| **Setup Complexity** | Medium | Medium | Medium |
| **Rebuild Required** | Yes | No | Yes |
| **Startup Speed** | Fast | Slower | Fast |
| **Config Changes** | Yes | Yes | No |
| **Best For** | Stability | Active Dev | Long-term Dev |
| **Easy Rollback** | Medium | Easy | Easy |

---

## My Recommendation

Based on your situation:

1. **If you're actively developing/debugging**: Use **Option 2** (tsx runtime)
2. **If you want stability with occasional updates**: Use **Option 1** (direct build)
3. **If you want the best of both worlds**: Use **Option 3** (global link)

For most users starting with local development, I recommend **Option 3** because:
- No config changes needed
- Familiar workflow
- Easy to switch back to marketplace version
- Works well for testing changes

---

## Additional Notes

### Current Configuration
Your current MCP settings point to:
```
cmd /c npx figma-developer-mcp
```

This runs the **marketplace version** from npm registry.

### Verifying Which Version Is Running
After switching, you can verify by checking the version or adding a console.log in your local code.

### Switching Back to Marketplace Version
- **Option 1/2**: Restore original MCP settings
- **Option 3**: Run `pnpm unlink --global` in the project directory