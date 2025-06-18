#!/usr/bin/env node

/**
 * Build script for Deno-specific builds
 * 
 * This script creates clean ESM builds for Deno environments by:
 * 1. Creating a dist/deno directory
 * 2. Copying source files with minimal processing
 * 3. Creating clean entry points for Deno
 */

const fs = require('fs');
const path = require('path');

const DIST_DENO = path.join(__dirname, '../dist/deno');
const SRC_DIR = path.join(__dirname, '../src');

// Ensure dist/deno directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Copy file with optional transformation
function copyFile(src, dest, transform = null) {
    const content = fs.readFileSync(src, 'utf8');
    const finalContent = transform ? transform(content) : content;
    fs.writeFileSync(dest, finalContent);
}

// Transform redis-mock to fix ES module export
function transformRedisMock(content) {
    // Replace the problematic export line with a proper one
    const fixed = content.replace(
        '// ES6 export for module compatibility\nexport default redismock;',
        `// ES6 export for module compatibility
let redismockExport;
if (typeof exports !== 'undefined' && typeof module !== 'undefined' && module.exports) {
    redismockExport = module.exports;
} else if (typeof globalThis !== 'undefined' && globalThis.redismock) {
    redismockExport = globalThis.redismock;
} else {
    // Fallback - create a minimal redis mock
    redismockExport = {};
}
export default redismockExport;`
    );
    return fixed;
}

// Copy directory recursively
function copyDir(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            // Apply transformation for redis-mock
            const transform = entry.name === 'redis-mock.js' ? transformRedisMock : null;
            copyFile(srcPath, destPath, transform);
        }
    }
}

function main() {
    console.log('🦕 Building Deno-specific packages...');
    
    // Clean and create deno dist directory
    if (fs.existsSync(DIST_DENO)) {
        fs.rmSync(DIST_DENO, { recursive: true });
    }
    ensureDir(DIST_DENO);
    
    // Copy utils directory (needed by deno-websocket-server)
    console.log('📁 Copying utils directory...');
    copyDir(path.join(SRC_DIR, 'utils'), path.join(DIST_DENO, 'utils'));
    
    // Copy deno-websocket-server.js
    console.log('🌐 Copying deno-websocket-server...');
    copyFile(
        path.join(SRC_DIR, 'deno-websocket-server.js'),
        path.join(DIST_DENO, 'deno-websocket-server.js')
    );
    
    // Create clean hypha-core.js for Deno (ESM version)
    console.log('⚡ Creating clean hypha-core for Deno...');
    copyFile(
        path.join(SRC_DIR, 'hypha-core.js'),
        path.join(DIST_DENO, 'hypha-core.js')
    );
    
    // Copy workspace.js
    console.log('🏢 Copying workspace module...');
    copyFile(
        path.join(SRC_DIR, 'workspace.js'),
        path.join(DIST_DENO, 'workspace.js')
    );
    
    // Create Deno entry point
    console.log('🚪 Creating Deno entry point...');
    const denoEntryContent = `// Deno entry point for hypha-core
export { HyphaCore, connectToServer, imjoyRPC, hyphaWebsocketClient, WebSocket, Workspace, WebsocketRPCConnection } from './dist/deno/hypha-core.js';
`;
    fs.writeFileSync(path.join(__dirname, '../deno.js'), denoEntryContent);
    
    console.log('✅ Deno build completed!');
    console.log('📦 Files created:');
    console.log('   - dist/deno/hypha-core.js');
    console.log('   - dist/deno/workspace.js');
    console.log('   - dist/deno/deno-websocket-server.js');
    console.log('   - dist/deno/utils/');
    console.log('   - deno.js (entry point)');
}

if (require.main === module) {
    main();
}

module.exports = { main }; 