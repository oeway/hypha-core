# Integration Tests

This directory contains integration tests for Hypha Core functionality that run in the Node.js environment using Playwright and Mocha.

## Important Note: Deno Tests Moved

**Deno-specific ASGI tests have been moved to `/test/deno/`** because they require the Deno runtime to function properly. The `DenoWebSocketServer` depends on Deno-specific APIs that are not available in Node.js.

For ASGI functionality testing, see:
- `/test/deno/asgi-tests.js` - Comprehensive ASGI and streaming tests
- `/test/deno/README.md` - Instructions for running Deno tests

## Test Files

## Current Integration Tests

The remaining integration tests in this folder focus on:

### Browser/Playwright Tests
- `iframe-webworker-integration.test.js` - Browser environment testing
- `hypha-core-integration.test.js` - Core functionality in browser context
- `debug-console-test.js` - Console functionality testing
- `debug-api-test.js` - API debugging functionality

## Running Tests

```bash
# Run all tests (including integration tests via Playwright)
npm test

# Run only unit tests (Node.js/Mocha)
npm run test:unit

# Run only integration tests (Browser/Playwright)
npm run test:integration

# For Deno ASGI tests, see /test/deno/README.md
```

## Test Environment

- **Integration Tests**: Use Playwright for browser-based testing
- **Unit Tests**: Use Mocha + Chai for Node.js testing  
- **Deno Tests**: Separate test suite in `/test/deno/` for Deno-specific functionality

## Coverage

The integration tests in this folder focus on:

✅ **Browser Environment Testing**
- Core functionality in browser context
- WebWorker and iframe integration
- Console and debugging features

✅ **Cross-Platform Compatibility**
- Ensures Hypha Core works in different environments
- Validates browser-specific APIs and features

For comprehensive ASGI, streaming, and Deno WebSocket server testing, see the dedicated Deno test suite in `/test/deno/`. 