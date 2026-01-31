const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestUser() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'my_database'
    });

    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['test@example.com']
    );

    if (existingUsers.length > 0) {
      console.log('✓ Test user already exists: test@example.com');
      await connection.end();
      return;
    }

    // Insert test user with role_id 4 (affiliate)
    const [result] = await connection.execute(
      'INSERT INTO users (role_id, name, email, password, status, affiliate_status) VALUES (?, ?, ?, ?, ?, ?)',
      [4, 'Test User', 'test@example.com', hashedPassword, 'active', 'inactive']
    );
    
    console.log('✓ Test user created successfully!');
    console.log('  Email: test@example.com');
    console.log('  Password: password123');
    console.log('  Role: Affiliate');
    
    await connection.end();
  } catch (error) {
    console.error('✗ Error creating test user:', error.message);
    process.exit(1);
  }
}

createTestUser().then(() => {
  console.log('\n✓ Setup complete! You can now login to test profile & settings.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
