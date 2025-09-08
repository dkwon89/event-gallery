const https = require('https');
const http = require('http');
const fs = require('fs');

// Read SSL certificates
const options = {
  key: fs.readFileSync('cert.key'),
  cert: fs.readFileSync('cert.crt')
};

// Create HTTPS proxy server
const server = https.createServer(options, (req, res) => {
  console.log(`Proxying ${req.method} ${req.url}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Proxy requests to Next.js dev server
  const proxyReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000'
    }
  }, (proxyRes) => {
    // Add CORS headers to response
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });

  req.pipe(proxyReq);
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTPS proxy server running at:`);
  console.log(`   https://localhost:${PORT}`);
  console.log(`   https://192.168.5.64:${PORT}`);
  console.log(`\n📱 Use the HTTPS URL on your phone for camera access!`);
  console.log(`\n⚠️  Make sure Next.js dev server is running on port 3000`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down HTTPS proxy...');
  server.close();
  process.exit(0);
});
