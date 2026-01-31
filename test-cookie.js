const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Test endpoint
app.get('/test-cookie', (req, res) => {
  console.log('\n🔍 Checking cookies...');
  console.log('📦 req.cookies:', req.cookies);
  console.log('📄 req.headers.cookie:', req.headers.cookie);
  
  res.json({
    success: true,
    cookies: req.cookies,
    message: 'Check console for details'
  });
});

// Set cookie endpoint
app.get('/set-cookie', (req, res) => {
  const testToken = 'test_jwt_token_12345';
  
  console.log('\n✅ Setting cookie...');
  res.cookie('token', testToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: false,
    sameSite: 'lax'
  });
  
  res.json({
    success: true,
    message: 'Cookie set! Check in browser DevTools → Application → Cookies'
  });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`\n🧪 Cookie Test Server running on http://localhost:${PORT}`);
  console.log('\nTest endpoints:');
  console.log('1. GET http://localhost:5001/set-cookie (set a test cookie)');
  console.log('2. GET http://localhost:5001/test-cookie (check if cookie is sent)\n');
});
