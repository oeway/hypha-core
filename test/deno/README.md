# Deno Tests

This directory contains tests that must run in the Deno environment to test functionality that depends on the Deno WebSocket server implementation.

## Test Files

### `asgi-tests.js`
Comprehensive tests for ASGI application functionality, including:
- Basic server startup and service registration
- HTTP API access to registered services
- ASGI app routing and responses
- Error handling and edge cases

Run with:
```bash
deno run --allow-net --allow-read --allow-env test/deno/asgi-tests.js
```

### `simple-asgi-test.js`
A simplified ASGI test for debugging basic functionality:
- Simple ASGI service registration
- Basic HTTP request/response cycle
- Minimal error debugging

Run with:
```bash
deno run --allow-net --allow-read --allow-env test/deno/simple-asgi-test.js
```

### `context-injection-test.js`
Tests for the context injection fix that ensures local services with `require_context: true` receive proper context:
- Context injection for services with `require_context: true`
- No context injection for services without `require_context`
- Nested service objects context injection
- Context merging when partial context is provided
- HTTP API calls receiving proper context
- ASGI services with context injection

Run with:
```bash
deno run --allow-net --allow-read --allow-env test/deno/context-injection-test.js
```

**What the Context Injection Tests Verify:**
- Local services with `require_context: true` automatically receive context containing `ws`, `user`, and `from` fields
- Services without `require_context` are not affected
- Nested service methods also receive proper context
- Context merging works when partial context is already provided
- Both function services and ASGI services work correctly with context injection

### `streaming-test.js` (NEW)
Tests for async generator streaming functionality in the HTTP proxy:
- Async generator streaming via HTTP with JSONL format
- Regular generator streaming support
- Promise-wrapped async generators
- Error handling in streaming responses
- Mixed data types streaming
- Real-time progressive response delivery

Run with:
```bash
deno run --allow-net --allow-read --allow-env test/deno/streaming-test.js
```

**What the Streaming Tests Verify:**
- Service functions returning async generators are automatically streamed as JSONL
- Regular (sync) generators are also properly streamed
- Functions returning promises that resolve to generators work correctly
- Errors in generators are captured and included in the stream
- Content-Type is set to `application/x-ndjson` for streaming responses
- Real-time streaming without buffering all data first

### `jwt-auth-test.js` (NEW)
Tests for the complete JWT authentication workflow with protected services:
- Server startup and JWT token generation
- JWT token parsing and user context extraction
- Protected service access with role-based authorization
- Cross-workspace authentication and access control
- Invalid token handling and fallback to anonymous users
- Multi-user HTTP API authentication

Run with:
```bash
deno run --allow-net --allow-read --allow-env test/deno/jwt-auth-test.js
```

**What the JWT Authentication Tests Verify:**
- JWT tokens are properly generated with user/workspace/role information
- HTTP requests with Bearer tokens extract user context correctly
- Protected services receive authenticated user context with proper `user.id`, `user.email`, `user.roles`, and `user.scopes`
- Role-based access control works (e.g., admin functions require admin role)
- Cross-workspace authentication preserves workspace isolation
- Invalid/malformed tokens gracefully fall back to anonymous users
- Anonymous access still works when no token is provided

### `debug-asgi.js`
Debug utilities and helpers for ASGI testing.

## Running All Tests

To run all Deno tests:

```bash
# Run individual tests
deno run --allow-net --allow-read --allow-env test/deno/asgi-tests.js
deno run --allow-net --allow-read --allow-env test/deno/simple-asgi-test.js
deno run --allow-net --allow-read --allow-env test/deno/context-injection-test.js
deno run --allow-net --allow-read --allow-env test/deno/streaming-test.js
deno run --allow-net --allow-read --allow-env test/deno/jwt-auth-test.js

# Or run from the project root via npm
npm run test:deno  # If configured in package.json
```

## Test Environment

These tests require:
- Deno runtime
- Network permissions (`--allow-net`)
- File system read permissions (`--allow-read`)
- Environment variable access (`--allow-env`)

Each test runs on different ports to avoid conflicts:
- `asgi-tests.js`: ports 9610-9619
- `simple-asgi-test.js`: port 9620
- `context-injection-test.js`: ports 9700-9705
- `streaming-test.js`: ports 9800-9803
- `jwt-auth-test.js`: ports 9810-9812

## Context Injection Fix

The context injection tests specifically verify the fix implemented in `src/workspace.js` that ensures:

1. **Local services** (services with actual function implementations) that have `config.require_context: true` automatically receive context as the last parameter
2. **Context structure** includes:
   - `ws`: workspace name (e.g., "default")
   - `user`: user information object with id, email, roles, scopes
   - `from`: client identifier (e.g., "default/anonymous-client")
3. **Context merging** preserves custom context properties while ensuring required fields are present
4. **No side effects** for services that don't require context

This fixes the issue where `context.ws` was `undefined` for local services, ensuring they work seamlessly with the same interface as remote services.

## Requirements

- [Deno](https://deno.land/) runtime installed
- The tests use Deno's built-in permissions system

## Running Tests

### Run all ASGI tests:
```bash
deno run --allow-net --allow-read --allow-env test/deno/asgi-tests.js
```

### Quick test (from project root):
```bash
# Make the test executable
chmod +x test/deno/asgi-tests.js

# Run with shebang
./test/deno/asgi-tests.js
```

## Test Coverage

### 1. Basic Server Functionality
- Server startup and shutdown in Deno environment
- Health endpoint accessibility
- Basic HTTP server functionality

### 2. Service Registration & HTTP API
- Service registration via `api.register_service()`
- Service info retrieval via HTTP `/services/{service_id}`
- Function service calls via HTTP with GET/POST
- Parameter passing and result handling

### 3. ASGI App Routing
- ASGI service registration with `type: 'asgi'`
- App routing via `/apps/{service_id}/{path}`
- Multiple route handling within ASGI apps
- JSON and text response handling
- Proper ASGI protocol implementation

### 4. Streaming Responses
- Real-time streaming with `more_body` flag
- Chunked response delivery
- Timing verification to ensure true streaming
- Memory-efficient data transfer
- Async generator streaming with JSONL format
- Regular generator streaming support
- Error handling in streaming responses

### 5. Error Handling
- 404 responses for non-existent routes
- 500 error responses from ASGI apps
- Proper HTTP status code handling
- Error message delivery

## Why Separate Deno Tests?

These tests are separated from Node.js tests because:

1. **Runtime Dependency**: The `DenoWebSocketServer` requires Deno-specific APIs
2. **Environment Differences**: Deno has different module resolution and global APIs
3. **Permission Model**: Deno uses a different security model with explicit permissions
4. **Native Features**: Tests use Deno's native HTTP server and WebSocket implementations

## Test Architecture

The tests use a simple custom test runner (`DenoTestRunner`) instead of external testing frameworks to:
- Minimize dependencies
- Keep tests lightweight
- Ensure compatibility with Deno's module system
- Provide clear, focused test output

## Integration with CI/CD

To include these tests in automated testing:

```yaml
# Example GitHub Actions step
- name: Run Deno ASGI Tests
  run: |
    deno run --allow-net --allow-read --allow-env test/deno/asgi-tests.js
```

## Adding New Tests

To add new Deno-specific tests:

1. Add test cases to `asgi-tests.js` using `runner.test(name, fn)`
2. Use the assertion helpers: `assert()`, `assertEqual()`, `assertContains()`
3. Ensure proper cleanup (call `hyphaCore.stop()`) in test teardown
4. Use unique ports for each test to avoid conflicts

## Comparison with Node.js Tests

| Feature | Node.js Tests | Deno Tests |
|---------|---------------|------------|
| Environment | Node.js + Mocha/Chai | Deno native |
| Server Type | Mock/Stub servers | Real DenoWebSocketServer |
| ASGI Support | Mocked responses | Full ASGI protocol |
| Streaming | Simulated | Real streaming |
| WebSockets | Mock-socket library | Deno native WebSockets |
| Purpose | Unit/Integration | End-to-end functionality | 