# Pure Bridge Implementation Plan - Part 2
## Continuation: Code Specifications, Testing, Migration & Timeline

**This is Part 2 of the Pure Bridge Implementation Plan**  
**See Part 1:** [PURE_BRIDGE_IMPLEMENTATION_PLAN.md](./PURE_BRIDGE_IMPLEMENTATION_PLAN.md)

---

## 4. Code Specifications (Continued)

### 4.1 Complete MCP Client Implementation

```typescript
// src/client/figma-mcp-client.ts (continued)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';
import type { OAuthManager } from '../auth/oauth-manager.js';
import { Logger } from '../utils/logger.js';

export class FigmaMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private connected: boolean = false;
  
  constructor(
    private config: {
      endpoint: string;
      timeout: number;
    },
    private oauthManager: OAuthManager
  ) {}
  
  async connect(): Promise<void> {
    if (this.connected) {
      Logger.info('Already connected to official Figma MCP server');
      return;
    }
    
    const token = await this.oauthManager.getValidToken();
    
    Logger.info('Connecting to official Figma MCP server', {
      endpoint: this.config.endpoint,
    });
    
    try {
      const url = new URL(this.config.endpoint);
      // TODO: Determine authentication mechanism
      this.transport = new SSEClientTransport(url);
      
      this.client = new Client(
        { name: 'figma-bridge-mcp', version: '1.0.0' },
        { capabilities: {} }
      );
      
      await this.client.connect(this.transport);
      this.connected = true;
      
      Logger.info('✓ Connected to official Figma MCP server');
    } catch (error) {
      this.connected = false;
      Logger.error('Failed to connect', { error });
      throw error;
    }
  }
  
  async listTools(): Promise<Tool[]> {
    this.ensureConnected();
    const result = await this.client!.request({ method: 'tools/list' });
    return result.tools;
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();
    Logger.debug('Calling tool', { name, args });
    
    const result = await this.client!.request({
      method: 'tools/call',
      params: { name, arguments: args },
    });
    
    return result;
  }
  
  async listResources(): Promise<Resource[]> {
    this.ensureConnected();
    const result = await this.client!.request({ method: 'resources/list' });
    return result.resources;
  }
  
  async readResource(uri: string): Promise<unknown> {
    this.ensureConnected();
    Logger.debug('Reading resource', { uri });
    
    const result = await this.client!.request({
      method: 'resources/read',
      params: { uri },
    });
    
    return result;
  }
  
  async listPrompts(): Promise<Prompt[]> {
    this.ensureConnected();
    const result = await this.client!.request({ method: 'prompts/list' });
    return result.prompts;
  }
  
  async getPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
    this.ensureConnected();
    Logger.debug('Getting prompt', { name, args });
    
    const result = await this.client!.request({
      method: 'prompts/get',
      params: { name, arguments: args },
    });
    
    return result;
  }
  
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.close();
      this.connected = false;
      this.client = null;
      this.transport = null;
      Logger.info('Disconnected from official Figma MCP server');
    }
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to official server');
    }
  }
}
```

### 4.2 Bridge Proxy Implementation

```typescript
// src/bridge/proxy.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FigmaMCPClient } from '../client/figma-mcp-client.js';
import { Logger } from '../utils/logger.js';
import { BridgeError, ErrorCode } from '../utils/errors.js';

export class BridgeProxy {
  constructor(
    private server: McpServer,
    private officialClient: FigmaMCPClient
  ) {}
  
  async initialize(): Promise<void> {
    Logger.info('Initializing bridge proxy');
    
    // Connect to official server
    await this.officialClient.connect();
    
    // Discover and register all tools
    await this.registerTools();
    
    // Discover and register all resources
    await this.registerResources();
    
    // Discover and register all prompts
    await this.registerPrompts();
    
    Logger.info('✓ Bridge proxy initialized');
  }
  
  private async registerTools(): Promise<void> {
    try {
      const tools = await this.officialClient.listTools();
      Logger.info(`Discovered ${tools.length} tools from official server`);
      
      for (const tool of tools) {
        this.server.registerTool(
          tool.name,
          {
            title: tool.title || tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          async (params: Record<string, unknown>) => {
            try {
              Logger.debug('Proxying tool call', { tool: tool.name });
              const result = await this.officialClient.callTool(tool.name, params);
              return this.transformToolResult(result);
            } catch (error) {
              Logger.error('Tool call failed', { tool: tool.name, error });
              throw this.mapError(error);
            }
          }
        );
        
        Logger.debug(`Registered tool: ${tool.name}`);
      }
    } catch (error) {
      Logger.error('Failed to register tools', { error });
      throw new BridgeError(
        'Failed to discover tools from official server',
        ErrorCode.TOOL_DISCOVERY_FAILED,
        error
      );
    }
  }
  
  private async registerResources(): Promise<void> {
    try {
      const resources = await this.officialClient.listResources();
      Logger.info(`Discovered ${resources.length} resources from official server`);
      
      for (const resource of resources) {
        this.server.registerResource(
          resource.uri,
          {
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          },
          async () => {
            try {
              Logger.debug('Proxying resource read', { uri: resource.uri });
              const result = await this.officialClient.readResource(resource.uri);
              return this.transformResourceResult(result);
            } catch (error) {
              Logger.error('Resource read failed', { uri: resource.uri, error });
              throw this.mapError(error);
            }
          }
        );
        
        Logger.debug(`Registered resource: ${resource.uri}`);
      }
    } catch (error) {
      Logger.error('Failed to register resources', { error });
      throw new BridgeError(
        'Failed to discover resources from official server',
        ErrorCode.RESOURCE_DISCOVERY_FAILED,
        error
      );
    }
  }
  
  private async registerPrompts(): Promise<void> {
    try {
      const prompts = await this.officialClient.listPrompts();
      Logger.info(`Discovered ${prompts.length} prompts from official server`);
      
      for (const prompt of prompts) {
        this.server.registerPrompt(
          prompt.name,
          {
            description: prompt.description,
            arguments: prompt.arguments,
          },
          async (args?: Record<string, string>) => {
            try {
              Logger.debug('Proxying prompt get', { prompt: prompt.name });
              const result = await this.officialClient.getPrompt(prompt.name, args);
              return this.transformPromptResult(result);
            } catch (error) {
              Logger.error('Prompt get failed', { prompt: prompt.name, error });
              throw this.mapError(error);
            }
          }
        );
        
        Logger.debug(`Registered prompt: ${prompt.name}`);
      }
    } catch (error) {
      Logger.error('Failed to register prompts', { error });
      throw new BridgeError(
        'Failed to discover prompts from official server',
        ErrorCode.PROMPT_DISCOVERY_FAILED,
        error
      );
    }
  }
  
  private transformToolResult(result: any): any {
    // Pass through, optionally add metadata
    if (typeof result === 'object' && result !== null) {
      return {
        ...result,
        _bridge: {
          proxied: true,
          server: 'figma-official',
          timestamp: new Date().toISOString(),
        },
      };
    }
    return result;
  }
  
  private transformResourceResult(result: any): any {
    // Pass through
    return result;
  }
  
  private transformPromptResult(result: any): any {
    // Pass through
    return result;
  }
  
  private mapError(error: unknown): Error {
    if (error instanceof Error) {
      return new BridgeError(
        `Official server error: ${error.message}`,
        ErrorCode.OFFICIAL_SERVER_ERROR,
        error
      );
    }
    return new BridgeError(
      'Unknown error from official server',
      ErrorCode.UNKNOWN_ERROR,
      error
    );
  }
}
```

### 4.3 Server Initialization

```typescript
// src/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { BridgeProxy } from './bridge/proxy.js';
import { FigmaMCPClient } from './client/figma-mcp-client.js';
import { OAuthManager } from './auth/oauth-manager.js';
import { Logger } from './utils/logger.js';
import type { Config } from './config.js';

export async function createBridgeServer(config: Config): Promise<McpServer> {
  Logger.info('Creating bridge MCP server');
  
  // Initialize OAuth manager
  const oauthManager = new OAuthManager({
    clientId: config.oauth.clientId,
    clientSecret: config.oauth.clientSecret,
    tokenStoragePath: config.oauth.tokenStoragePath,
  });
  
  await oauthManager.initialize();
  Logger.info('✓ OAuth initialized');
  
  // Create official MCP client
  const officialClient = new FigmaMCPClient(
    {
      endpoint: config.officialServer.endpoint,
      timeout: config.officialServer.timeout,
    },
    oauthManager
  );
  
  // Create MCP server
  const server = new McpServer({
    name: 'Figma Bridge MCP Server',
    version: '1.0.0',
    description: 'Proxy to official Figma MCP server',
  });
  
  // Create and initialize bridge proxy
  const bridge = new BridgeProxy(server, officialClient);
  await bridge.initialize();
  
  // Setup cleanup
  const cleanup = async () => {
    Logger.info('Shutting down bridge server');
    await officialClient.disconnect();
    Logger.info('✓ Shutdown complete');
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  return server;
}

export async function startServer(config: Config): Promise<void> {
  const server = await createBridgeServer(config);
  
  if (config.bridge.transport === 'stdio') {
    Logger.info('Starting bridge server in stdio mode');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    Logger.info('✓ Bridge server running (stdio)');
  } else {
    throw new Error(`Transport ${config.bridge.transport} not yet implemented`);
  }
}
```

### 4.4 Error Handling

```typescript
// src/utils/errors.ts
export enum ErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  
  // Discovery errors
  TOOL_DISCOVERY_FAILED = 'TOOL_DISCOVERY_FAILED',
  RESOURCE_DISCOVERY_FAILED = 'RESOURCE_DISCOVERY_FAILED',
  PROMPT_DISCOVERY_FAILED = 'PROMPT_DISCOVERY_FAILED',
  
  // Proxy errors
  TOOL_CALL_FAILED = 'TOOL_CALL_FAILED',
  RESOURCE_READ_FAILED = 'RESOURCE_READ_FAILED',
  PROMPT_GET_FAILED = 'PROMPT_GET_FAILED',
  
  // Official server errors
  OFFICIAL_SERVER_ERROR = 'OFFICIAL_SERVER_ERROR',
  OFFICIAL_SERVER_UNAVAILABLE = 'OFFICIAL_SERVER_UNAVAILABLE',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export class BridgeError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'BridgeError';
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

export function isBridgeError(error: unknown): error is BridgeError {
  return error instanceof BridgeError;
}

export function isRetryableError(error: unknown): boolean {
  if (isBridgeError(error)) {
    return [
      ErrorCode.CONNECTION_TIMEOUT,
      ErrorCode.CONNECTION_LOST,
      ErrorCode.OFFICIAL_SERVER_UNAVAILABLE,
    ].includes(error.code);
  }
  return false;
}
```

### 4.5 Logging Utility

```typescript
// src/utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;
  
  static setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  static debug(message: string, meta?: Record<string, any>): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, meta);
    }
  }
  
  static info(message: string, meta?: Record<string, any>): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, meta);
    }
  }
  
  static warn(message: string, meta?: Record<string, any>): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, meta);
    }
  }
  
  static error(message: string, meta?: Record<string, any>): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, meta);
    }
  }
  
  private static log(level: string, message: string, meta?: Record<string, any>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    
    console.error(JSON.stringify(entry));
  }
}
```

---

## 5. Configuration Requirements

### 5.1 Environment Variables

```bash
# .env.example

# ============================================
# Official Figma MCP Server Configuration
# ============================================
FIGMA_MCP_ENDPOINT=https://mcp.figma.com/mcp
FIGMA_MCP_TIMEOUT=30000

# ============================================
# OAuth Configuration (REQUIRED)
# ============================================
FIGMA_OAUTH_CLIENT_ID=your_client_id_here
FIGMA_OAUTH_CLIENT_SECRET=your_client_secret_here
FIGMA_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
FIGMA_TOKEN_STORAGE_PATH=./.figma-tokens

# ============================================
# Bridge Server Configuration
# ============================================
BRIDGE_TRANSPORT=stdio
BRIDGE_HOST=localhost
BRIDGE_PORT=3000
LOG_LEVEL=info

# ============================================
# Retry Configuration
# ============================================
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=1000
RETRY_MAX_DELAY=10000
```

### 5.2 Configuration Validation

All configuration is validated using Zod schemas (see `src/config.ts` in Part 1).

**Required Variables:**
- `FIGMA_OAUTH_CLIENT_ID` - OAuth client ID from Figma
- `FIGMA_OAUTH_CLIENT_SECRET` - OAuth client secret from Figma
- `FIGMA_OAUTH_REDIRECT_URI` - OAuth redirect URI

**Optional Variables:**
- All others have sensible defaults

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// tests/unit/bridge/proxy.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeProxy } from '../../../src/bridge/proxy.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('BridgeProxy', () => {
  let mockServer: McpServer;
  let mockOfficialClient: any;
  let proxy: BridgeProxy;
  
  beforeEach(() => {
    mockServer = {
      registerTool: vi.fn(),
      registerResource: vi.fn(),
      registerPrompt: vi.fn(),
    } as any;
    
    mockOfficialClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([
        {
          name: 'generate_figma_design',
          description: 'Generate design',
          inputSchema: {},
        },
      ]),
      listResources: vi.fn().mockResolvedValue([]),
      listPrompts: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ success: true }),
    };
    
    proxy = new BridgeProxy(mockServer, mockOfficialClient);
  });
  
  it('should initialize and connect to official server', async () => {
    await proxy.initialize();
    
    expect(mockOfficialClient.connect).toHaveBeenCalled();
    expect(mockOfficialClient.listTools).toHaveBeenCalled();
  });
  
  it('should register all discovered tools', async () => {
    await proxy.initialize();
    
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'generate_figma_design',
      expect.any(Object),
      expect.any(Function)
    );
  });
  
  it('should proxy tool calls to official server', async () => {
    await proxy.initialize();
    
    const toolHandler = (mockServer.registerTool as any).mock.calls[0][2];
    const result = await toolHandler({ html: '<div>test</div>' });
    
    expect(mockOfficialClient.callTool).toHaveBeenCalledWith(
      'generate_figma_design',
      { html: '<div>test</div>' }
    );
    expect(result).toHaveProperty('_bridge');
  });
});
```

### 6.2 Integration Tests

```typescript
// tests/integration/bridge-to-official.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBridgeServer } from '../../src/server.js';
import { loadConfig } from '../../src/config.js';

describe('Bridge to Official Server Integration', () => {
  let server: any;
  let config: any;
  
  beforeAll(async () => {
    config = loadConfig();
    server = await createBridgeServer(config);
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  it('should connect to official Figma MCP server', async () => {
    // Test connection
    expect(server).toBeDefined();
  });
  
  it('should discover tools from official server', async () => {
    // Test tool discovery
  });
  
  it('should successfully proxy a tool call', async () => {
    // Test tool proxying
  });
});
```

### 6.3 End-to-End Tests

```typescript
// tests/integration/end-to-end.test.ts
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

describe('End-to-End Bridge Tests', () => {
  it('should work with MCP client', async () => {
    // Spawn bridge server
    const serverProcess = spawn('node', ['dist/index.js', '--stdio']);
    
    // Create MCP client
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js', '--stdio'],
    });
    
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    
    await client.connect(transport);
    
    // List tools
    const tools = await client.request({ method: 'tools/list' });
    expect(tools.tools).toBeInstanceOf(Array);
    expect(tools.tools.length).toBeGreaterThan(0);
    
    // Cleanup
    await client.close();
    serverProcess.kill();
  });
});
```

### 6.4 Error Scenario Tests

```typescript
// tests/integration/error-scenarios.test.ts
import { describe, it, expect } from 'vitest';

describe('Error Scenarios', () => {
  it('should handle connection failures gracefully', async () => {
    // Test connection failure handling
  });
  
  it('should handle token expiration', async () => {
    // Test token refresh
  });
  
  it('should handle official server unavailability', async () => {
    // Test error handling
  });
  
  it('should handle invalid tool calls', async () => {
    // Test validation
  });
});
```

### 6.5 Performance Benchmarks

```typescript
// scripts/benchmark.ts
import { performance } from 'perf_hooks';

async function benchmarkToolCall() {
  const iterations = 100;
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Call tool through bridge
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`Average: ${avg.toFixed(2)}ms`);
  console.log(`Min: ${min.toFixed(2)}ms`);
  console.log(`Max: ${max.toFixed(2)}ms`);
}

benchmarkToolCall();
```

---

## 7. Migration Path

### 7.1 Pre-Migration Checklist

- [ ] **Backup current implementation**
  ```bash
  git tag pre-bridge-migration
  git push origin pre-bridge-migration
  ```

- [ ] **Document current configuration**
  - List all environment variables
  - Document all custom features
  - Export user data if any

- [ ] **Communicate with users**
  - Announce migration timeline
  - Explain breaking changes
  - Provide migration guide

- [ ] **Set up OAuth credentials**
  - Create Figma OAuth app
  - Configure redirect URIs
  - Test OAuth flow

### 7.2 Migration Steps

#### Step 1: Create Migration Branch (Day 1)

```bash
git checkout -b migration/pure-bridge
git push -u origin migration/pure-bridge
```

#### Step 2: Implement Bridge (Weeks 1-4)

Follow implementation guide in Part 1 and this document.

#### Step 3: Testing Phase (Week 5)

```bash
# Run all tests
npm run test

# Run integration tests
npm run test:integration

# Run benchmarks
npm run benchmark

# Manual testing with Claude Desktop
# Update MCP settings to point to bridge
```

#### Step 4: Beta Release (Week 5)

```bash
# Create beta release
git tag v2.0.0-beta.1
npm publish --tag beta

# Announce beta to users
# Gather feedback
```

#### Step 5: Production Release (Week 6)

```bash
# Final testing
npm run test:all

# Create release
git tag v2.0.0
npm publish

# Update documentation
# Announce release
```

### 7.3 Rollback Procedure

If issues arise:

```bash
# Revert to previous version
git checkout pre-bridge-migration

# Republish old version
npm publish

# Notify users
```

### 7.4 Data Preservation

**No data migration needed** - Bridge is stateless except for OAuth tokens.

**OAuth Token Migration:**
```bash
# Tokens stored in .figma-tokens
# No migration needed - users re-authenticate
```

---

## 8. Documentation Requirements

### 8.1 README Updates

```markdown
# Figma Bridge MCP Server

A lightweight MCP server that proxies all requests to the official Figma MCP server.

## Features

- ✅ Zero maintenance - automatically stays in sync with official server
- ✅ All official Figma MCP tools, resources, and prompts
- ✅ OAuth authentication
- ✅ Automatic token refresh
- ✅ Connection management and retry logic

## Quick Start

1. Install:
   ```bash
   npm install -g figma-bridge-mcp
   ```

2. Set up OAuth:
   ```bash
   figma-bridge-mcp setup-oauth
   ```

3. Configure MCP client:
   ```json
   {
     "mcpServers": {
       "figma": {
         "command": "figma-bridge-mcp",
         "args": ["--stdio"]
       }
     }
   }
   ```

## Requirements

- Node.js 18+
- Figma OAuth credentials
- Internet connection (bridge requires connection to official server)

## Configuration

See [CONFIGURATION.md](./docs/CONFIGURATION.md)

## Troubleshooting

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
```

### 8.2 Configuration Guide

Create `docs/CONFIGURATION.md` with:
- All environment variables
- OAuth setup instructions
- Transport options
- Logging configuration
- Retry policies

### 8.3 OAuth Setup Guide

Create `docs/OAUTH_SETUP.md` with:
- Step-by-step OAuth app creation
- Redirect URI configuration
- Token management
- Troubleshooting auth issues

### 8.4 Troubleshooting Guide

Create `docs/TROUBLESHOOTING.md` with:
- Common errors and solutions
- Connection issues
- Authentication problems
- Performance issues
- Debug mode instructions

### 8.5 Architecture Documentation

Create `docs/ARCHITECTURE.md` with:
- System architecture diagrams
- Component descriptions
- Data flow diagrams
- Security considerations

---

## 9. Success Criteria

### 9.1 Functional Criteria

- ✅ **Tool Proxying**
  - All tools from official server are discoverable
  - Tool calls are correctly forwarded
  - Responses are correctly returned
  - Error handling works properly

- ✅ **Resource Proxying**
  - All resources are discoverable
  - Resource reads work correctly
  - URIs are properly handled

- ✅ **Prompt Proxying**
  - All prompts are discoverable
  - Prompt gets work correctly
  - Arguments are properly passed

- ✅ **Authentication**
  - OAuth flow works end-to-end
  - Tokens refresh automatically
  - Authentication errors handled gracefully

- ✅ **Connection Management**
  - Connects to official server reliably
  - Reconnects on connection loss
  - Handles server unavailability

### 9.2 Performance Criteria

- ✅ **Latency**
  - Tool calls complete within 2x direct API time
  - Connection establishment < 5 seconds
  - Token refresh < 2 seconds

- ✅ **Reliability**
  - 99.9% uptime (when official server is up)
  - Successful retry on transient failures
  - No data loss

### 9.3 Compatibility Criteria

- ✅ **MCP Clients**
  - Works with Claude Desktop
  - Works with Cursor
  - Works with VS Code extensions
  - Works with custom MCP clients

- ✅ **Transports**
  - Stdio transport works
  - SSE transport works (if implemented)
  - HTTP transport works (if implemented)

### 9.4 Validation Steps

1. **Tool Discovery**
   ```bash
   # List all tools
   mcp-client list-tools
   
   # Verify all official tools present
   ```

2. **Tool Execution**
   ```bash
   # Call each tool
   mcp-client call-tool generate_figma_design --args '{...}'
   
   # Verify responses match official server
   ```

3. **Resource Access**
   ```bash
   # List resources
   mcp-client list-resources
   
   # Read each resource
   mcp-client read-resource figma://...
   ```

4. **Error Handling**
   ```bash
   # Test invalid tool call
   # Test connection loss
   # Test token expiration
   # Verify graceful handling
   ```

5. **Performance**
   ```bash
   # Run benchmarks
   npm run benchmark
   
   # Verify latency acceptable
   ```

---

## 10. Timeline & Resources

### 10.1 Detailed Timeline

#### Week 1: Foundation (40 hours)
- **Days 1-2:** Project setup, dependencies, configuration (16h)
- **Days 3-5:** OAuth manager, MCP client implementation (24h)

#### Week 2: Core Bridge (40 hours)
-