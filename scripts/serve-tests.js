#!/usr/bin/env node

/**
 * Simple HTTP server for serving Hypha Core integration tests
 * Usage: npm run serve:tests
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// MIME types mapping
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(data);
    });
}

function serveDirectory(res, dirPath) {
    fs.readdir(dirPath, (err, files) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 Internal Server Error</h1>');
            return;
        }

        const fileList = files
            .filter(file => !file.startsWith('.'))
            .map(file => {
                const filePath = path.join(dirPath, file);
                const stat = fs.statSync(filePath);
                const isDir = stat.isDirectory();
                const size = isDir ? '-' : `${Math.round(stat.size / 1024)}KB`;
                const modified = stat.mtime.toLocaleDateString();
                
                return `
                    <tr>
                        <td><a href="${file}${isDir ? '/' : ''}">${file}${isDir ? '/' : ''}</a></td>
                        <td>${size}</td>
                        <td>${modified}</td>
                    </tr>
                `;
            })
            .join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hypha Core Test Server</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #2c3e50; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
                    th { background-color: #f5f5f5; }
                    a { color: #3498db; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    .highlight { background-color: #fff3cd; padding: 10px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1>🧪 Hypha Core Test Server</h1>
                <div class="highlight">
                    <strong>Quick Start:</strong>
                    <ul>
                        <li><a href="test.html">🧪 Run Integration Tests</a> - Comprehensive test suite</li>
                        <li><a href="lite.html">⚡ Hypha Lite Demo</a> - Plugin loader demo</li>
                        <li><a href="jwt-example.html">🔐 JWT Examples</a> - Authentication examples</li>
                    </ul>
                </div>
                <h2>📁 Files</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Size</th>
                            <th>Modified</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fileList}
                    </tbody>
                </table>
                <hr>
                <p>Server running on <strong>http://localhost:${PORT}</strong></p>
            </body>
            </html>
        `;

        res.writeHead(200, { 
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(html);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Remove leading slash and decode
    pathname = decodeURIComponent(pathname.substring(1));

    // Default to index.html if root
    if (pathname === '') {
        pathname = 'index.html';
    }

    const fullPath = path.join(PUBLIC_DIR, pathname);

    // Security check - ensure we're not serving files outside public dir
    if (!fullPath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 Forbidden</h1>');
        return;
    }

    // Check if file/directory exists
    fs.stat(fullPath, (err, stat) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        if (stat.isDirectory()) {
            // Check for index.html in directory
            const indexPath = path.join(fullPath, 'index.html');
            fs.stat(indexPath, (indexErr) => {
                if (!indexErr) {
                    serveFile(res, indexPath);
                } else {
                    serveDirectory(res, fullPath);
                }
            });
        } else {
            serveFile(res, fullPath);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Hypha Core Test Server started`);
    console.log(`📂 Serving files from: ${PUBLIC_DIR}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🧪 Integration Tests: http://localhost:${PORT}/test.html`);
    console.log(`⚡ Hypha Lite: http://localhost:${PORT}/lite.html`);
    console.log(`🔐 JWT Examples: http://localhost:${PORT}/jwt-example.html`);
    console.log('\n🛑 Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
}); 