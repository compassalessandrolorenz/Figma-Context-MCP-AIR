# Pure Bridge Implementation Plan
## Complete Guide for Option 2: Proxy-Only MCP Server

**Document Version:** 1.0  
**Created:** 2026-03-20  
**Status:** 📋 DETAILED SPECIFICATION  
**Estimated Timeline:** 4-6 weeks

---

## ⚠️ IMPORTANT DISCLAIMER

This document provides a complete implementation plan for a **pure bridge MCP server** that proxies all requests to the official Figma MCP server. 

**However, this approach is NOT RECOMMENDED for this project** because:
- ❌ Loses significant existing value (custom transformations, offline support)
- ❌ Breaking changes for all users
- ❌ Eliminates unique features
- ❌ Forces OAuth complexity on everyone

**Recommended Approach:** Enhanced Hybrid Architecture (see [ARCHITECTURE_DECISION_SUMMARY.md](./ARCHITECTURE_DECISION_SUMMARY.md))

This plan is provided for completeness and as a reference for potential future scenarios.

---

## Table of Contents

1. [Architecture Design](#1-architecture-design)
2. [File Structure](#2-file-structure)
3. [Step-by-Step Implementation Guide](#3-step-by-step-implementation-guide)
4. [Code Specifications](#4-code-specifications)
5. [Configuration Requirements](#5-configuration-requirements)
6. [Testing Strategy](#6-testing-strategy)
7. [Migration Path](#7-migration-path)
8. [Documentation Requirements](#8-documentation-requirements)
9. [Success Criteria](#9-success-criteria)
10. [Timeline & Resources](#10-timeline--resources)

---

## 1. Architecture Design

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Clients                              │
│         (Claude Desktop, Cursor, VS Code, etc.)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ MCP Protocol (stdio/SSE/HTTP)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Figma Bridge MCP Server (Local)                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           MCP Server Implementation                  │  │
│  │  • Server initialization                             │  │
│  │  • Transport handling (stdio/SSE/HTTP)               │  │
│  │  • Protocol message routing                          │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           Bridge Proxy Layer                         │  │
│  │  • Request forwarding                                │  │
│  │  • Response transformation                           │  │
│  │  • Error mapping                                     │  │
│  │  • Connection management                             │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           MCP Client (to Official Server)            │  │
│  │  • SSE transport                                     │  │
│  │  • OAuth authentication                              │  │
│  │  • Token management                                  │  │
│  │  • Connection pooling                                │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           Support Services                           │  │
│  │  • OAuth token manager                               │  │
│  │  • Request/response logger                           │  │
│  │  • Health checker                                    │  │
│  │  • Metrics collector                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ MCP Protocol over SSE/HTTPS
                         │ + OAuth Bearer Token
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Official Figma MCP Server                      │
│                  (mcp.figma.com)                            │
│                                                             │
│  • generate_figma_design                                    │
│  • (other official tools)                                   │
│  • (resources)                                              │
│  • (prompts)                                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Figma REST API
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Figma Platform                           │
│                  (api.figma.com)                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Bridge MCP Server                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Stdio      │  │     SSE      │  │     HTTP     │     │
│  │  Transport   │  │  Transport   │  │  Transport   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           │                                │
│                  ┌────────▼────────┐                       │
│                  │  MCP Protocol   │                       │
│                  │     Router      │                       │
│                  └────────┬────────┘                       │
│                           │                                │
│         ┌─────────────────┼─────────────────┐             │
│         │                 │                 │             │
│  ┌──────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐      │
│  │    Tools     │  │  Resources  │  │   Prompts   │      │
│  │    Proxy     │  │    Proxy    │  │    Proxy    │      │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘      │
│         │                 │                 │             │
│         └─────────────────┼─────────────────┘             │
│                           │                                │
│                  ┌────────▼────────┐                       │
│                  │  Request/       │                       │
│                  │  Response       │                       │
│                  │  Transformer    │                       │
│                  └────────┬────────┘                       │
│                           │                                │
│                  ┌────────▼────────┐                       │
│                  │  Official MCP   │                       │
│                  │     Client      │                       │
│                  └────────┬────────┘                       │
│                           │                                │
│         ┌─────────────────┼─────────────────┐             │
│         │                 │                 │             │
│  ┌──────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐      │
│  │    OAuth     │  │   Logger    │  │   Health    │      │
│  │   Manager    │  │             │  │   Checker   │      │
│  └──────────────┘  └─────────────┘  └─────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ SSE + OAuth
                           ▼
                  ┌─────────────────┐
                  │  Official Figma │
                  │   MCP Server    │
                  └─────────────────┘
```

### 1.3 Data Flow Diagram

```
Client Request Flow:
──────────────────

1. Client → Bridge Server
   ┌─────────────────────────────────────────┐
   │ MCP Request (stdio/SSE/HTTP)            │
   │ {                                       │
   │   "jsonrpc": "2.0",                     │
   │   "method": "tools/call",               │
   │   "params": {                           │
   │     "name": "generate_figma_design",    │
   │     "arguments": {...}                  │
   │   }                                     │
   │ }                                       │
   └─────────────────────────────────────────┘
                    │
                    ▼
2. Bridge Server Processing
   ┌─────────────────────────────────────────┐
   │ • Validate request                      │
   │ • Log request                           │
   │ • Check OAuth token validity            │
   │ • Refresh token if needed               │
   └─────────────────────────────────────────┘
                    │
                    ▼
3. Bridge → Official Server
   ┌─────────────────────────────────────────┐
   │ MCP Request over SSE                    │
   │ Headers:                                │
   │   Authorization: Bearer <token>         │
   │ Body: (same as received)                │
   └─────────────────────────────────────────┘
                    │
                    ▼
4. Official Server Processing
   ┌─────────────────────────────────────────┐
   │ • Authenticate request                  │
   │ • Execute tool                          │
   │ • Generate response                     │
   └─────────────────────────────────────────┘
                    │
                    ▼
5. Official Server → Bridge
   ┌─────────────────────────────────────────┐
   │ MCP Response                            │
   │ {                                       │
   │   "jsonrpc": "2.0",                     │
   │   "result": {                           │
   │     "content": [...]                    │
   │   }                                     │
   │ }                                       │
   └─────────────────────────────────────────┘
                    │
                    ▼
6. Bridge Server Processing
   ┌─────────────────────────────────────────┐
   │ • Validate response                     │
   │ • Log response                          │
   │ • Transform if needed                   │
   │ • Add metadata                          │
   └─────────────────────────────────────────┘
                    │
                    ▼
7. Bridge → Client
   ┌─────────────────────────────────────────┐
   │ MCP Response (same transport)           │
   │ (potentially with added metadata)       │
   └─────────────────────────────────────────┘
```

### 1.4 Communication Patterns

#### Pattern 1: Tool Call Proxying

```typescript
// Client calls tool
client.callTool("generate_figma_design", { html: "<div>..." })
  ↓
// Bridge receives and forwards
bridge.onToolCall(async (name, args) => {
  const result = await officialClient.callTool(name, args);
  return result; // Pass through
})
  ↓
// Official server executes
officialServer.executeTool("generate_figma_design", args)
  ↓
// Response flows back through bridge
bridge → client
```

#### Pattern 2: Resource Access Proxying

```typescript
// Client requests resource
client.readResource("figma://file/abc123")
  ↓
// Bridge forwards to official server
bridge.onResourceRead(async (uri) => {
  const resource = await officialClient.readResource(uri);
  return resource; // Pass through
})
  ↓
// Official server provides resource
officialServer.getResource(uri)
  ↓
// Resource flows back
bridge → client
```

#### Pattern 3: Prompt Proxying

```typescript
// Client requests prompt
client.getPrompt("design-to-code")
  ↓
// Bridge forwards
bridge.onGetPrompt(async (name, args) => {
  const prompt = await officialClient.getPrompt(name, args);
  return prompt; // Pass through
})
  ↓
// Official server provides prompt
officialServer.getPrompt(name, args)
  ↓
// Prompt flows back
bridge → client
```

#### Pattern 4: OAuth Token Refresh

```typescript
// Before each request
async function ensureValidToken() {
  if (tokenManager.isExpired()) {
    await tokenManager.refresh();
  }
  return tokenManager.getToken();
}

// In request flow
const token = await ensureValidToken();
officialClient.setAuthToken(token);
await officialClient.callTool(...);
```

---

## 2. File Structure

### 2.1 Complete Directory Structure

```
figma-bridge-mcp/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI/CD pipeline
│       └── release.yml               # Release automation
│
├── src/
│   ├── index.ts                      # Main entry point
│   ├── server.ts                     # Bridge server initialization
│   ├── config.ts                     # Configuration management
│   │
│   ├── bridge/
│   │   ├── index.ts                  # Bridge exports
│   │   ├── proxy.ts                  # Core proxy logic
│   │   ├── tools-proxy.ts            # Tool call proxying
│   │   ├── resources-proxy.ts        # Resource access proxying
│   │   ├── prompts-proxy.ts          # Prompt proxying
│   │   └── transformer.ts            # Request/response transformation
│   │
│   ├── client/
│   │   ├── index.ts                  # Client exports
│   │   ├── figma-mcp-client.ts       # Official server client
│   │   ├── connection-manager.ts     # Connection pooling
│   │   └── retry-handler.ts          # Retry logic
│   │
│   ├── auth/
│   │   ├── index.ts                  # Auth exports
│   │   ├── oauth-manager.ts          # OAuth token management
│   │   ├── token-storage.ts          # Secure token storage
│   │   └── token-refresh.ts          # Automatic refresh
│   │
│   ├── transport/
│   │   ├── index.ts                  # Transport exports
│   │   ├── stdio-transport.ts        # Stdio transport handler
│   │   ├── sse-transport.ts          # SSE transport handler
│   │   └── http-transport.ts         # HTTP transport handler
│   │
│   ├── utils/
│   │   ├── logger.ts                 # Structured logging
│   │   ├── errors.ts                 # Error classes
│   │   ├── validator.ts              # Request/response validation
│   │   ├── metrics.ts                # Metrics collection
│   │   └── health-check.ts           # Health monitoring
│   │
│   └── types/
│       ├── index.ts                  # Type exports
│       ├── mcp.ts                    # MCP protocol types
│       ├── bridge.ts                 # Bridge-specific types
│       └── config.ts                 # Configuration types
│
├── tests/
│   ├── unit/
│   │   ├── bridge/
│   │   │   ├── proxy.test.ts
│   │   │   ├── tools-proxy.test.ts
│   │   │   └── transformer.test.ts
│   │   ├── client/
│   │   │   ├── figma-mcp-client.test.ts
│   │   │   └── connection-manager.test.ts
│   │   └── auth/
│   │       ├── oauth-manager.test.ts
│   │       └── token-refresh.test.ts
│   │
│   ├── integration/
│   │   ├── bridge-to-official.test.ts
│   │   ├── end-to-end.test.ts
│   │   └── error-scenarios.test.ts
│   │
│   ├── fixtures/
│   │   ├── mcp-requests.json
│   │   ├── mcp-responses.json
│   │   └── mock-tokens.json
│   │
│   └── helpers/
│       ├── mock-official-server.ts
│       ├── mock-mcp-client.ts
│       └── test-utils.ts
│
├── scripts/
│   ├── setup-oauth.ts                # OAuth setup wizard
│   ├── test-connection.ts            # Connection tester
│   ├── migrate-from-hybrid.ts        # Migration script
│   └── benchmark.ts                  # Performance testing
│
├── docs/
│   ├── README.md                     # Main documentation
│   ├── ARCHITECTURE.md               # Architecture details
│   ├── CONFIGURATION.md              # Configuration guide
│   ├── OAUTH_SETUP.md                # OAuth setup guide
│   ├── TROUBLESHOOTING.md            # Troubleshooting guide
│   ├── MIGRATION.md                  # Migration guide
│   └── API.md                        # API documentation
│
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── .nvmrc                            # Node version
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tsup.config.ts                    # Build config
├── vitest.config.ts                  # Test config
├── eslint.config.js                  # Linting config
└── README.md                         # Project README
```

### 2.2 File Purposes

#### Core Files

| File | Purpose | Key Responsibilities |
|------|---------|---------------------|
| `src/index.ts` | Entry point | CLI argument parsing, server startup |
| `src/server.ts` | Server init | Transport setup, bridge initialization |
| `src/config.ts` | Configuration | Load and validate all settings |

#### Bridge Layer

| File | Purpose | Key Responsibilities |
|------|---------|---------------------|
| `bridge/proxy.ts` | Core proxy | Main proxying logic, request routing |
| `bridge/tools-proxy.ts` | Tool proxying | Forward tool calls to official server |
| `bridge/resources-proxy.ts` | Resource proxying | Forward resource requests |
| `bridge/prompts-proxy.ts` | Prompt proxying | Forward prompt requests |
| `bridge/transformer.ts` | Transformation | Request/response modification if needed |

#### Client Layer

| File | Purpose | Key Responsibilities |
|------|---------|---------------------|
| `client/figma-mcp-client.ts` | MCP client | Connect to official Figma MCP server |
| `client/connection-manager.ts` | Connection pool | Manage connections, reconnection |
| `client/retry-handler.ts` | Retry logic | Handle failures, exponential backoff |

#### Auth Layer

| File | Purpose | Key Responsibilities |
|------|---------|---------------------|
| `auth/oauth-manager.ts` | OAuth management | Token lifecycle management |
| `auth/token-storage.ts` | Token storage | Secure storage (keychain/file) |
| `auth/token-refresh.ts` | Auto-refresh | Background token refresh |

---

## 3. Step-by-Step Implementation Guide

### Phase 1: Project Setup (Week 1, Days 1-2)

#### Step 1.1: Create New Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/pure-bridge-implementation

# Create directory structure
mkdir -p src/{bridge,client,auth,transport,utils,types}
mkdir -p tests/{unit,integration,fixtures,helpers}
mkdir -p scripts docs
```

#### Step 1.2: Initialize Package Configuration

```bash
# Install dependencies
pnpm install @modelcontextprotocol/sdk@^1.27.1
pnpm install zod@^3.25.76
pnpm install dotenv@^16.4.7

# Install dev dependencies
pnpm install -D typescript@^5.7.3
pnpm install -D vitest@^4.0.18
pnpm install -D tsup@^8.5.1
pnpm install -D @types/node@^25.3.3
```

#### Step 1.3: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### Step 1.4: Configure Build System

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node18',
});
```

### Phase 2: Core Bridge Implementation (Week 1, Days 3-5)

#### Step 2.1: Implement Configuration Management

```typescript
// src/config.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  // Official Figma MCP Server
  officialServer: z.object({
    endpoint: z.string().url().default('https://mcp.figma.com/mcp'),
    transport: z.enum(['sse']).default('sse'),
    timeout: z.number().positive().default(30000),
  }),
  
  // OAuth Configuration
  oauth: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
    tokenStoragePath: z.string().default('./.figma-tokens'),
  }),
  
  // Bridge Server Configuration
  bridge: z.object({
    transport: z.enum(['stdio', 'sse', 'http']).default('stdio'),
    host: z.string().default('localhost'),
    port: z.number().int().positive().default(3000),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
  
  // Retry Configuration
  retry: z.object({
    maxAttempts: z.number().int().min(0).max(10).default(3),
    initialDelay: z.number().positive().default(1000),
    maxDelay: z.number().positive().default(10000),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const config = {
    officialServer: {
      endpoint: process.env.FIGMA_MCP_ENDPOINT,
      transport: 'sse' as const,
      timeout: parseInt(process.env.FIGMA_MCP_TIMEOUT || '30000', 10),
    },
    oauth: {
      clientId: process.env.FIGMA_OAUTH_CLIENT_ID!,
      clientSecret: process.env.FIGMA_OAUTH_CLIENT_SECRET!,
      redirectUri: process.env.FIGMA_OAUTH_REDIRECT_URI!,
      tokenStoragePath: process.env.FIGMA_TOKEN_STORAGE_PATH,
    },
    bridge: {
      transport: (process.env.BRIDGE_TRANSPORT as any) || 'stdio',
      host: process.env.BRIDGE_HOST,
      port: parseInt(process.env.BRIDGE_PORT || '3000', 10),
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    },
    retry: {
      maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
      initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10),
      maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000', 10),
    },
  };
  
  return ConfigSchema.parse(config);
}
```

#### Step 2.2: Implement OAuth Manager

```typescript
// src/auth/oauth-manager.ts
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  tokenType: z.string().default('Bearer'),
});

export type Token = z.infer<typeof TokenSchema>;

export class OAuthManager {
  private token: Token | null = null;
  private refreshPromise: Promise<Token> | null = null;
  
  constructor(
    private config: {
      clientId: string;
      clientSecret: string;
      tokenStoragePath: string;
    }
  ) {}
  
  async initialize(): Promise<void> {
    try {
      this.token = await this.loadToken();
    } catch (error) {
      throw new Error(
        'No valid OAuth token found. Please run: npm run setup-oauth'
      );
    }
  }
  
  async getValidToken(): Promise<Token> {
    if (!this.token) {
      throw new Error('OAuth not initialized');
    }
    
    // Check if token is expired or will expire in next 5 minutes
    const expiresIn = this.token.expiresAt - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      // Token expired or expiring soon, refresh it
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshToken();
      }
      this.token = await this.refreshPromise;
      this.refreshPromise = null;
    }
    
    return this.token;
  }
  
  private async loadToken(): Promise<Token> {
    const tokenPath = path.resolve(this.config.tokenStoragePath);
    const data = await fs.readFile(tokenPath, 'utf-8');
    const token = JSON.parse(data);
    return TokenSchema.parse(token);
  }
  
  private async saveToken(token: Token): Promise<void> {
    const tokenPath = path.resolve(this.config.tokenStoragePath);
    await fs.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.writeFile(tokenPath, JSON.stringify(token, null, 2), 'utf-8');
  }
  
  private async refreshToken(): Promise<Token> {
    if (!this.token) {
      throw new Error('No token to refresh');
    }
    
    const response = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    const newToken: Token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
    };
    
    await this.saveToken(newToken);
    return newToken;
  }
}
```

#### Step 2.3: Implement Official MCP Client

```typescript
// src/client/figma-mcp-client.ts
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
    
    // Get valid OAuth token
    const token = await this.oauthManager.getValidToken();
    
    Logger.info('Connecting to official Figma MCP server', {
      endpoint: this.config.endpoint,
    });
    
    try {
      // Create SSE transport
      // Note: Authentication mechanism needs to be determined
      // This may require URL parameters or custom headers
      const url = new URL(this.config.endpoint);
      // TODO: Add authentication - investigate Figma's mechanism
      // Possible options:
      // 1. url.searchParams.set('token', token.accessToken);
      // 2. Custom headers (if supported)
      // 3. Connection handshake
      
      this.transport = new SSEClientTransport(url);
      
      // Create MCP client
      this.client = new Client(
        {
          name: 'figma-bridge-mcp',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );
      
      // Connect
      await this.client.connect(this.transport);
      this.connected = true;
      
      Logger.info('✓ Connected to official Figma MCP server');
    } catch (error) {
      this.connected = false;
      Logger.error('Failed to connect to official Figma MCP server', { error });
      throw error;
    }
  }
  
  async listTools(): Promise<Tool[]> {
    this.ensureConnected();
    
    const result = await this.client!.request({
      method: 'tools/list',
    });
    
    return result.tools;
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();
    
    Logger.debug('Calling tool on official server', { name, args });
    
    const result = await this.client!.request({
      method: 'tools/call',
      params: {
        name,
        arguments