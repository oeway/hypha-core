# Deno Tests

This folder contains tests that run specifically in the Deno environment. These tests require the Deno runtime to execute properly because they use the `DenoWebSocketServer` which depends on Deno-specific APIs.

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