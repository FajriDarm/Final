const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('\n🔐 JWT Token Testing\n');
console.log('=' . repeat(50));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test data
const payload = {
  user_id: 1,
  email: 'test@example.com',
  role: 'affiliate'
};

console.log('\n📦 Payload:', JSON.stringify(payload, null, 2));
console.log('\n🔑 JWT_SECRET:', JWT_SECRET.substring(0, 20) + '...');

// Create token
try {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  console.log('\n✅ Token created successfully!');
  console.log('\n📄 Token (first 50 chars):', token.substring(0, 50) + '...');
  
  // Verify token
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('\n✅ Token verified successfully!');
  console.log('\n📦 Decoded payload:', JSON.stringify(decoded, null, 2));
  
  // Test with wrong secret
  try {
    jwt.verify(token, 'wrong-secret');
    console.log('\n❌ ERROR: Token verified with wrong secret (should fail!)');
  } catch (error) {
    console.log('\n✅ Token correctly rejected with wrong secret');
  }
  
  // Test with expired token
  const expiredToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });
  setTimeout(() => {
    try {
      jwt.verify(expiredToken, JWT_SECRET);
      console.log('\n❌ ERROR: Expired token verified (should fail!)');
    } catch (error) {
      console.log('\n✅ Expired token correctly rejected');
    }
  }, 100);
  
} catch (error) {
  console.log('\n❌ Error creating/verifying token:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');
