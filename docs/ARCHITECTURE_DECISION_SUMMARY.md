# Architecture Decision Summary
## Figma MCP Server: Bridge vs Local Implementation

**Decision Date:** 2026-03-20  
**Status:** ✅ RECOMMENDED APPROACH DEFINED

---

## TL;DR - Executive Summary

### Question
Should we create a pure bridge MCP that proxies to the official Figma MCP server, or continue with local tool implementations?

### Answer
**✅ Continue with Enhanced Hybrid Architecture**

Keep the current 13 local tools AND enhance the bridge capabilities for official-only features like `generate_figma_design`.

### Why?
- Preserves unique value (offline support, custom transformations, privacy)
- Adds official features via optional bridge
- Provides flexibility and fallback options
- Minimizes breaking changes for users
- Allows gradual migration and testing

---

## Current State Analysis

### Original Implementation (2 Tools)
1. `download_figma_images` - Download images
2. `get_figma_data` - Get raw Figma data

### Current Implementation (14 Tools)
The project has **expanded 7x** with comprehensive functionality:

**✅ What's Working Well:**
- 13 local tools with excellent data transformation
- 1 bridge tool (`generate_figma_design`) already implemented
- Strong security improvements (path traversal fix, rate limiting, error handling)
- Offline support with Personal Access Token
- Custom features not available in official server

**⚠️ What Needs Work:**
- OAuth integration incomplete (needed for bridge)
- SSE authentication mechanism unclear
- Bridge infrastructure partially implemented
- No dynamic tool discovery from official server

---

## The Three Options

### Option 1: Pure Local Implementation (Current Approach)
```
Local MCP → Figma REST API
```

**Pros:**
- ✅ Works offline
- ✅ No OAuth complexity
- ✅ Custom transformations
- ✅ Full control

**Cons:**
- ❌ High maintenance burden
- ❌ Feature lag behind official
- ❌ Missing generative features
- ❌ API parity challenges

### Option 2: Pure Bridge Implementation
```
Local Bridge → Official Figma MCP → Figma
```

**Pros:**
- ✅ Minimal maintenance
- ✅ Automatic feature parity
- ✅ Official features first

**Cons:**
- ❌ No offline support
- ❌ OAuth required
- ❌ Loses custom features
- ❌ Network dependency
- ❌ Breaking changes for users

### Option 3: Hybrid Architecture (RECOMMENDED)
```
                    ┌─→ Local Tools (13) → Figma REST API
Local MCP Router ──┤
                    └─→ Bridge Tools (1+) → Official Figma MCP
```

**Pros:**
- ✅ Best of both worlds
- ✅ Flexibility for users
- ✅ Gradual migration path
- ✅ Fallback options
- ✅ Preserves existing value

**Cons:**
- ⚠️ More complex architecture
- ⚠️ Need to maintain both paths
- ⚠️ OAuth setup for bridge features

---

## Detailed Comparison

| Aspect | Local Only | Pure Bridge | Hybrid (✅ Recommended) |
|--------|-----------|-------------|------------------------|
| **Offline Support** | ✅ Yes | ❌ No | ✅ Yes (local tools) |
| **OAuth Required** | ❌ No | ✅ Yes | ⚠️ Optional (for bridge) |
| **Maintenance Burden** | ❌ High | ✅ Low | ⚠️ Medium |
| **Feature Parity** | ❌ Lag | ✅ Automatic | ✅ Best available |
| **Custom Features** | ✅ Yes | ❌ No | ✅ Yes |
| **Setup Complexity** | ✅ Low | ❌ High | ⚠️ Medium |
| **Performance** | ✅ Fast | ⚠️ Network latency | ✅ Fast (local) |
| **Privacy** | ✅ High | ⚠️ Data to Figma | ✅ High (local) |
| **Breaking Changes** | ✅ None | ❌ Major | ✅ Minimal |
| **User Flexibility** | ⚠️ Limited | ⚠️ Limited | ✅ Maximum |

---

## Recommended Tool Strategy

| Tool | Strategy | Rationale |
|------|----------|-----------|
| `generate_figma_design` | ✅ **Bridge Only** | Only available on official server |
| `get_design_context` | ✅ **Keep Local** | Core feature, custom transformation |
| `download_figma_images` | ✅ **Keep Local** | Works well, reliable |
| `get_screenshot` | ✅ **Keep Local** | Simple, no official equivalent |
| `get_variable_defs` | ✅ **Keep Local** | Custom extraction logic |
| `create_design_system_rules` | ✅ **Keep Local** | Unique feature |
| `get_metadata` | ✅ **Keep Local** | Custom XML format |
| `get_figjam` | ✅ **Keep Local** | Unique feature |
| `whoami` | ⚠️ **Consider Bridge** | Simple, could use official |
| `get_code_connect_*` (4 tools) | ⚠️ **Consider Bridge** | May exist officially |
| `get_figma_data` | ⚠️ **Deprecate** | Legacy alias |

---

## Implementation Roadmap

### Phase 1: Complete OAuth Integration (2-3 weeks) 🔴 CRITICAL

**Goal:** Make bridge architecture production-ready

**Tasks:**
1. Make `FigmaService.getAuthHeaders()` async
2. Integrate `OAuthTokenManager.getValidToken()` into main service
3. Add automatic token refresh before API calls
4. Solve SSE authentication mechanism (currently unknown)
5. Test OAuth flow end-to-end
6. Handle token expiration gracefully

**Files to Modify:**
- [`src/services/figma.ts`](../Figma-Context-MCP-Extension/src/services/figma.ts)
- [`src/config.ts`](../Figma-Context-MCP-Extension/src/config.ts)
- [`src/remote/oauth-manager.ts`](../Figma-Context-MCP-Extension/src/remote/oauth-manager.ts)
- [`src/remote/figma-mcp-client.ts`](../Figma-Context-MCP-Extension/src/remote/figma-mcp-client.ts)

**Success Criteria:**
- ✅ Bridge tools work with OAuth
- ✅ Tokens refresh automatically
- ✅ Authentication errors handled gracefully
- ✅ SSE authentication working

### Phase 2: Enhance Bridge Infrastructure (1-2 weeks) 🟡 HIGH PRIORITY

**Goal:** Make bridge robust and feature-complete

**Tasks:**
1. Implement dynamic tool discovery from official server
2. Add intelligent routing (local vs bridge)
3. Implement fallback to local on bridge failure
4. Add circuit breaker pattern
5. Enhance error handling and logging
6. Add bridge-specific monitoring

**New Features:**
```typescript
// Auto-register all tools from official server
async function discoverAndRegisterRemoteTools() {
  const tools = await remoteClient.listTools();
  for (const tool of tools) {
    registerProxyTool(tool);
  }
}

// Intelligent routing
function getToolHandler(toolName: string) {
  if (hasLocalImplementation(toolName)) {
    return localTools[toolName];
  }
  if (remoteMCPEnabled && hasRemoteImplementation(toolName)) {
    return createProxy(toolName);
  }
  throw new Error(`Tool ${toolName} not available`);
}
```

**Success Criteria:**
- ✅ All official tools auto-discovered
- ✅ Graceful fallback working
- ✅ Error handling comprehensive
- ✅ Performance acceptable

### Phase 3: Documentation & Testing (1-2 weeks) 🟢 MEDIUM PRIORITY

**Goal:** Help users adopt bridge features

**Tasks:**
1. Write OAuth setup guide
2. Document bridge vs local comparison
3. Create migration guide
4. Add troubleshooting documentation
5. Write integration tests for bridge
6. Test all bridge scenarios
7. Performance benchmarking

**Deliverables:**
- OAuth setup guide
- Bridge configuration guide
- Migration guide
- Troubleshooting guide
- Test suite for bridge
- Performance comparison

**Success Criteria:**
- ✅ Users can set up OAuth easily
- ✅ Clear guidance on when to use bridge
- ✅ All bridge features tested
- ✅ Performance documented

### Phase 4: Optimization & Monitoring (1 week) 🔵 LOW PRIORITY

**Goal:** Production-ready monitoring and optimization

**Tasks:**
1. Add request caching for bridge calls
2. Implement telemetry and metrics
3. Add health checks
4. Optimize performance
5. Add usage analytics

---

## Critical Blockers

### 🔴 BLOCKER 1: SSE Authentication Mechanism Unknown

**Problem:**
```typescript
// Line 48-49 in figma-mcp-client.ts
// Note: SSEClientTransport doesn't support custom headers in constructor
// TODO: Investigate Figma's authentication mechanism for SSE transport
```

**Impact:** Bridge may not work at all without solving this

**Resolution Options:**
1. Research Figma's official documentation
2. Contact Figma support/developer relations
3. Reverse engineer from official examples
4. Use alternative transport if available

**Priority:** 🔴 CRITICAL - Must solve before Phase 1 completion

### 🟡 BLOCKER 2: OAuth Token Refresh Not Integrated

**Problem:** Token manager exists but not used in main service

**Impact:** Tokens will expire, breaking bridge functionality

**Resolution:** Integrate `OAuthTokenManager.getValidToken()` into `FigmaService`

**Priority:** 🔴 CRITICAL - Part of Phase 1

---

## Risk Assessment

### High Risks

1. **SSE Authentication Failure**
   - **Risk:** Can't authenticate with official server
   - **Mitigation:** Research thoroughly, have fallback plan
   - **Impact:** Bridge features unusable

2. **Official Server Unavailability**
   - **Risk:** Official server down or deprecated
   - **Mitigation:** Keep local tools as fallback
   - **Impact:** Bridge features unavailable

3. **OAuth Complexity**
   - **Risk:** Users struggle with OAuth setup
   - **Mitigation:** Excellent documentation, make optional
   - **Impact:** Low bridge adoption

### Medium Risks

1. **Performance Degradation**
   - **Risk:** Bridge adds latency
   - **Mitigation:** Caching, keep local tools for performance-critical ops
   - **Impact:** Slower response times

2. **Maintenance Burden**
   - **Risk:** Maintaining both local and bridge
   - **Mitigation:** Deprecate redundant tools gradually
   - **Impact:** Higher development cost

### Low Risks

1. **Feature Divergence**
   - **Risk:** Local and bridge tools behave differently
   - **Mitigation:** Clear documentation, testing
   - **Impact:** User confusion

---

## Success Metrics

### Adoption Metrics
- % of users enabling bridge features
- Bridge tool usage vs local tools
- OAuth setup completion rate

### Reliability Metrics
- Bridge uptime percentage
- Authentication success rate
- Error rate comparison (bridge vs local)
- Fallback activation frequency

### Performance Metrics
- Average response time (bridge vs local)
- Cache hit rate
- API quota usage
- Network latency impact

### User Satisfaction
- Setup difficulty feedback
- Feature completeness rating
- Support ticket volume
- User retention rate

---

## Decision Rationale

### Why NOT Pure Bridge?

1. **Loses Unique Value**
   - Custom data transformations optimized for AI
   - Offline support critical for many users
   - Privacy benefits of local processing
   - Unique features (FigJam, design system rules)

2. **Breaking Changes**
   - All users forced to OAuth
   - Offline workflows broken
   - Setup complexity increases dramatically
   - Risk of user churn

3. **Uncertain Coverage**
   - Don't know if official server has all needed tools
   - May need to maintain some local tools anyway
   - Risk of incomplete migration

4. **Significant Investment Loss**
   - 5000+ lines of well-tested code
   - Excellent extractor architecture
   - Custom transformers and optimizations
   - User trust and adoption

### Why Hybrid is Best?

1. **Preserves Value**
   - Keep all existing functionality
   - No breaking changes
   - Users choose what works for them

2. **Adds Capabilities**
   - Access to official-only features
   - Automatic updates for bridged tools
   - Best of both worlds

3. **Flexibility**
   - Gradual adoption path
   - Fallback options
   - User choice

4. **Risk Mitigation**
   - Test bridge reliability before full commitment
   - Maintain backward compatibility
   - Graceful degradation

5. **Future-Proof**
   - Can deprecate local tools gradually
   - Can expand bridge as official server improves
   - Can pivot strategy based on learnings

---

## Next Steps

### Immediate Actions (This Week)

1. ✅ **Review and approve this architecture decision**
2. 🔴 **Start Phase 1: OAuth Integration**
   - Assign developer(s)
   - Set up development environment
   - Begin research on SSE authentication

3. 📋 **Create detailed technical specifications**
   - OAuth integration design
   - Bridge infrastructure design
   - Testing strategy

### Short Term (Next 2-4 Weeks)

4. 🔴 **Complete Phase 1**
   - OAuth fully integrated
   - SSE authentication solved
   - Bridge working end-to-end

5. 🟡 **Begin Phase 2**
   - Dynamic tool discovery
   - Intelligent routing
   - Enhanced error handling

### Medium Term (1-2 Months)

6. 🟢 **Complete Phase 2 & 3**
   - Bridge infrastructure complete
   - Documentation finished
   - Testing comprehensive

7. 🔵 **Begin Phase 4**
   - Optimization
   - Monitoring
   - Analytics

---

## Conclusion

The **Enhanced Hybrid Architecture** is the optimal path forward because it:

✅ Preserves the significant value already created  
✅ Adds official features via bridge  
✅ Provides maximum flexibility for users  
✅ Minimizes breaking changes and risk  
✅ Allows gradual migration and testing  
✅ Future-proofs the architecture  

This decision balances pragmatism (keeping what works) with innovation (adding bridge capabilities), while respecting user needs and minimizing risk.

---

## Appendix: Key Questions Answered

### Q: Is the new implementation doing this the right way?

**A:** Yes, with caveats. The local implementation is excellent and provides unique value. The bridge implementation is partially complete and needs OAuth integration to be production-ready. The hybrid approach is the right strategy.

### Q: Could we just create an MCP that proxies to the official server?

**A:** Yes, technically feasible, but **not recommended** for this project because:
- Would lose significant existing value
- Would break all current users
- Would require OAuth for everyone
- Would eliminate offline support
- Uncertain if official server has all needed tools

However, the infrastructure for this already exists and could be expanded if needed in the future.

### Q: What's the recommended path forward?

**A:** Complete the OAuth integration (Phase 1), enhance the bridge infrastructure (Phase 2), and maintain the hybrid architecture. This gives users the best of both worlds while preserving existing value.

---

**Document Version:** 1.0  
**Author:** AI Cockpit Architect Mode  
**Status:** ✅ APPROVED FOR IMPLEMENTATION  
**Next Review:** After Phase 1 completion

For detailed technical analysis, see: [PROJECT_ARCHITECTURE_ANALYSIS.md](./PROJECT_ARCHITECTURE_ANALYSIS.md)