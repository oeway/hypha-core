// Test endpoints - use actual working endpoints
const endpoints = [
    { path: '/default/services/benchmark-service/math.multiply?a=9&b=22', name: 'Math Multiply' },
    { path: '/default/services/benchmark-service/math.add?a=15&b=30', name: 'Math Add' },
    { path: '/default/services/benchmark-service/string.upper?s=performance', name: 'String Upper' },
    { path: '/default/services/benchmark-service/echo?message=benchmark', name: 'Echo' },
    { path: '/default/services/benchmark-service/status', name: 'Status' }
]; 