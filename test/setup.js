const { JSDOM } = require('jsdom');
const chai = require('chai');
const sinon = require('sinon');

// Setup JSDOM for browser environment simulation
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Environment</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>
`, {
    url: 'http://localhost:8080',
    pretendToBeVisual: true,
    resources: 'usable'
});

// Expose globals
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;
        
        // Simulate connection after a brief delay
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 10);
    }
    
    send(data) {
        // Mock send implementation
        console.log('MockWebSocket send:', data);
    }
    
    close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
    }
};

// Mock fetch for HTTP requests
global.fetch = async (url, options = {}) => {
    return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
        headers: new Map()
    };
};

// Mock URL constructor
global.URL = dom.window.URL;

// Mock crypto for random ID generation
global.crypto = {
    getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }
};

// Mock atob and btoa for JWT parsing
global.atob = (str) => {
    return Buffer.from(str, 'base64').toString('binary');
};

global.btoa = (str) => {
    return Buffer.from(str, 'binary').toString('base64');
};

// Setup chai
global.expect = chai.expect;
global.sinon = sinon;

// Suppress console logs during tests unless explicitly needed
const originalConsole = global.console;
global.console = {
    ...originalConsole,
    log: () => {}, // Suppress logs
    warn: () => {}, // Suppress warnings
    error: originalConsole.error // Keep errors visible
}; 