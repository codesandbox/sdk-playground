# CodeSandbox SDK Migration Guide: 1.0.0 → 2.0.2

This guide documents the migration process from CodeSandbox SDK 1.0.0 to 2.0.2 based on a real-world migration of a Tasks API playground application.

## Overview

The migration from SDK 1.0.0 to 2.0.2 involved several breaking changes that required significant code updates. This guide covers each breaking change encountered, explains why the changes were necessary, and provides the solutions implemented.

## Breaking Changes Summary

1. [WebSocketSession → SandboxClient](#1-websocketsession--sandboxclient)
2. [connectToSandbox API Changes](#2-connecttosandbox-api-changes)
3. [Async Method Updates](#3-async-method-updates)
4. [Port API Restructure](#4-port-api-restructure)
5. [Session Creation Changes](#5-session-creation-changes)
6. [Removed Parameters](#6-removed-parameters)
7. [Filesystem API](#7-filesystem-api)
8. [Preview Protocol Updates](#8-preview-protocol-updates)

---

## 1. WebSocketSession → SandboxClient

### The Problem
The `WebSocketSession` type was completely removed in SDK 2.0.2, breaking all component interfaces and type definitions.

### Why This Changed
The SDK moved to a more unified client architecture with `SandboxClient` providing a cleaner, more consistent API surface.

### Migration Required

**Before (1.0.0):**
```typescript
import { WebSocketSession } from "@codesandbox/sdk/browser";

interface Props {
  session: WebSocketSession;
}

export function TasksComponent({ session }: Props) {
  // Component implementation
}
```

**After (2.0.2):**
```typescript
import { SandboxClient } from "@codesandbox/sdk/browser";

interface Props {
  session: SandboxClient;
}

export function TasksComponent({ session }: Props) {
  // Component implementation
}
```

### Files Updated
- `src/Tasks.tsx`
- `src/Preview.tsx`
- `src/Command.tsx`
- `src/Terminal.tsx`
- `src/Interpreters.tsx`

---

## 2. connectToSandbox API Changes

### The Problem
The `connectToSandbox` function signature changed from accepting a session directly to accepting a configuration object.

### Why This Changed
The new API supports additional configuration options while maintaining backward compatibility through the object pattern.

### Migration Required

**Before (1.0.0):**
```typescript
const session = await connectToSandbox(sessionData.session);
```

**After (2.0.2) - Minimal Required Change:**
```typescript
const session = await connectToSandbox({
  session: sessionData.session
});
```

### Optional Enhancements
The new API also supports optional features for better UX:

```typescript
const session = await connectToSandbox({
  session: sessionData.session,
  // Optional: Fallback function for reconnection scenarios
  getSession: (id) => fetch(`/api/sandboxes/${id}`)
    .then(res => res.json())
    .then(data => data.session),
  // Optional: Progress callback during connection
  initStatusCb(status) {
    console.log("Connection status:", status);
  }
});
```

**Note:** The `getSession` and `initStatusCb` are **not required** for basic functionality. They provide enhanced error handling and user feedback but can be omitted for simple use cases.

### Files Updated
- `src/App.tsx`

---

## 3. Async Method Updates

### The Problem
Several previously synchronous methods became async, causing TypeScript errors and runtime issues.

### Why This Changed
Making these methods async allows for better error handling and supports remote operations that may have network latency.

### Migration Required

**Before (1.0.0):**
```typescript
// Synchronous calls
const tasks = session.tasks.getAll();
const terminals = session.terminals.getAll();
const commands = session.commands.getAll();
const ports = session.ports.get();
```

**After (2.0.2):**
```typescript
// Async calls with await
const tasks = await session.tasks.getAll();
const terminals = await session.terminals.getAll();
const commands = await session.commands.getAll();
const ports = await session.ports.get();
```

### Methods That Became Async
- `tasks.getAll()`
- `terminals.getAll()`
- `commands.getAll()`
- `ports.get()`

### Files Updated
- `src/Tasks.tsx`
- `src/Command.tsx`
- `src/Terminal.tsx`

---

## 4. Port API Restructure

### The Problem
The port object structure changed, removing the `.host` property and changing how URLs are generated.

### Why This Changed
The new API provides more flexibility and consistency in how host URLs are managed across different environments.

### Migration Required

**Before (1.0.0):**
```typescript
const ports = await session.ports.get();
const url = ports[0].host; // ❌ .host no longer exists
```

**After (2.0.2):**
```typescript
const ports = await session.ports.get();
const url = session.hosts.getUrl(ports[0].port); // ✅ Use hosts.getUrl()
```

### Why This Approach
- **Environment agnostic** - works in different deployment contexts
- **Consistent URL generation** - centralized through `hosts.getUrl()`
- **Better port management** - clearer separation of concerns

### Files Updated
- `src/Tasks.tsx`
- `src/Preview.tsx`

---

## 5. Session Creation Changes

### The Problem
The session creation method changed from `createBrowserSession()` to `createSession()`.

### Why This Changed
Simplified API with unified session creation across different contexts (browser, Node.js, etc.).

### Migration Required

**Before (1.0.0):**
```typescript
const session = await sandbox.createBrowserSession();
```

**After (2.0.2):**
```typescript
const session = await sandbox.createSession();
```

### Files Updated
- `server.ts`

---

## 6. Removed Parameters

### The Problem
The `source: "git"` parameter was removed from sandbox creation, causing API errors.

### Why This Changed
The SDK simplified sandbox creation by removing less commonly used parameters and focusing on the core use cases.

### Migration Required

**Before (1.0.0):**
```typescript
const sandbox = await sdk.sandboxes.create({
  source: "git", // ❌ No longer supported
  // other options
});
```

**After (2.0.2):**
```typescript
const sandbox = await sdk.sandboxes.create({
  // ✅ Simplified creation without source parameter
});
```

### Files Updated
- `server.ts`

---

## 7. Filesystem API

### The Problem
While not a breaking change, the new filesystem API provided better ways to write files than using shell commands.

### Why This Was Added
The filesystem API provides:
- **Better error handling** than shell commands
- **Cross-platform compatibility**
- **Type safety** for file operations

### Migration Opportunity

**Before (using shell commands):**
```typescript
const packageJsonCommand = `cat > package.json << 'EOF'
${JSON.stringify(packageJson, null, 2)}
EOF`;
await client.commands.run(packageJsonCommand);
```

**After (using filesystem API):**
```typescript
await client.fs.writeTextFile("package.json", JSON.stringify(packageJson, null, 2));
```

### Benefits
- **More reliable** file operations
- **Better TypeScript support**
- **Cleaner code** without shell escaping issues

### Files Updated
- `server.ts`

### Documentation
- [SDK Filesystem API](https://codesandbox.io/docs/sdk/filesystem)

---

## 8. Preview Protocol Updates

### The Problem
The preview protocol implementation required updates to work properly with the new SDK architecture.

### Why This Changed
Improved preview protocol provides better message handling and more robust iframe communication.

### Migration Required

**Before (1.0.0):**
```typescript
// Basic preview setup without proper protocol injection
const preview = createPreview(url);
```

**After (2.0.2):**
```typescript
// Enhanced setup with protocol injection and status callbacks
const preview = createPreview(url);

preview.onStatusChange((status) => {
  if (status === "CONNECTED") {
    preview.injectAndInvoke(function setupProtocol({ previewProtocol }) {
      if (window.setupPreviewProtocol) {
        window.setupPreviewProtocol(previewProtocol);
      }
    }, {});
  }
});
```

### Benefits
- **Better connection handling** with status callbacks
- **More robust message passing** between parent and iframe
- **Proper protocol injection** for complex applications

### Files Updated
- `src/Preview.tsx`

---

## Common Patterns and Solutions

### 1. Error Handling
Always wrap async SDK calls in try-catch blocks:

```typescript
try {
  const tasks = await session.tasks.getAll();
  console.log("✅ Successfully retrieved tasks:", tasks.length);
} catch (error) {
  console.error("❌ Error loading tasks:", error);
}
```

### 2. Status Monitoring
Use console logging to provide visibility into SDK operations:

```typescript
console.log("🔍 Loading tasks using SDK Tasks API...");
const tasks = await session.tasks.getAll();
console.log("✅ Successfully retrieved tasks:", tasks.length);
```

### 3. Async/Await Patterns
Convert all SDK method calls to use async/await:

```typescript
// ❌ Old synchronous pattern
const tasks = session.tasks.getAll();

// ✅ New async pattern  
const tasks = await session.tasks.getAll();
```

## Development Tools

### Clearing Vite Cache
Import resolution issues were solved by clearing Vite's cache:

```bash
rm -rf node_modules/.vite
npm run dev
```

## Testing Your Migration

1. **Verify Types**: Ensure all TypeScript errors are resolved
2. **Test Core Functions**: Test sandbox creation, connection, and basic operations
3. **Check Async Operations**: Verify all async methods work correctly
4. **Test UI Components**: Ensure all React components render and function properly
5. **Validate API Calls**: Confirm all SDK API calls return expected data

## Resources

- [CodeSandbox SDK 2.0.2 Documentation](https://codesandbox.io/docs/sdk)
- [Browser SDK Reference](https://codesandbox.io/docs/sdk/browser)
- [Tasks API Documentation](https://codesandbox.io/docs/sdk/tasks)
- [Filesystem API Documentation](https://codesandbox.io/docs/sdk/filesystem)

## Conclusion

The migration from SDK 1.0.0 to 2.0.2 requires careful attention to:

1. **Type updates** (WebSocketSession → SandboxClient)
2. **API signature changes** (connectToSandbox pattern)
3. **Async method conversions** (adding await to multiple methods)
4. **Object structure changes** (port.host → hosts.getUrl)
5. **Removed parameters** (source: "git")

While the migration requires significant changes, the new SDK provides:
- **Better error handling**
- **More consistent APIs**
- **Improved TypeScript support**
- **Enhanced development experience**

The effort invested in migration pays off with a more robust and maintainable codebase. 