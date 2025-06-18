// Main entry point for hypha-core (Node.js/CommonJS)
// This uses dynamic import to work around CommonJS/ESM compatibility issues

const loadHyphaCore = async () => {
    // Load the clean Deno build (no webpack overhead, works in Node.js)
    const module = await import('./dist/deno/hypha-core.js');
    return module;
};

// Export a promise-based API for dynamic loading
module.exports = loadHyphaCore;

// Also export individual functions for convenience
module.exports.loadHyphaCore = loadHyphaCore;
