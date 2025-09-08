const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');

// Read SSL certificates
const options = {
  key: fs.readFileSync('cert.key'),
  cert: fs.readFileSync('cert.crt')
};

// Start Next.js dev server
const nextProcess = exec('npm run dev', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error starting Next.js: ${error}`);
    return;
  }
});

// Create HTTPS proxy server
const server = https.createServer(options, (req, res) => {
  // Proxy requests to Next.js dev server
  const proxyReq = require('http').request({
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  req.pipe(proxyReq);
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTPS server running at:`);
  console.log(`   https://localhost:${PORT}`);
  console.log(`   https://192.168.5.64:${PORT}`);
  console.log(`\n📱 Use the HTTPS URL on your phone for camera access!`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  nextProcess.kill();
  server.close();
  process.exit(0);
});
