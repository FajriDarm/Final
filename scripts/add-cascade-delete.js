const db = require('../config/database');

async function setupCascadeDelete() {
  try {
    console.log('Setting up CASCADE DELETE for event foreign keys...');

    // 1. Drop and recreate foreign key for affiliate_links
    console.log('1. Updating affiliate_links foreign key...');
    await db.query('ALTER TABLE affiliate_links DROP FOREIGN KEY affiliate_links_ibfk_2');
    await db.query(`
      ALTER TABLE affiliate_links 
      ADD CONSTRAINT fk_affiliate_links_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ affiliate_links updated');

    // 2. Drop and recreate foreign key for affiliate_referrals
    console.log('2. Updating affiliate_referrals foreign key...');
    await db.query('ALTER TABLE affiliate_referrals DROP FOREIGN KEY affiliate_referrals_ibfk_2');
    await db.query(`
      ALTER TABLE affiliate_referrals 
      ADD CONSTRAINT fk_affiliate_referrals_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ affiliate_referrals updated');

    // 3. Drop and recreate foreign key for transactions
    console.log('3. Updating transactions foreign key...');
    await db.query('ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_1');
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ transactions updated');

    console.log('\n✅ CASCADE DELETE setup completed successfully!');
    console.log('Now you can delete events without foreign key errors.');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up CASCADE DELETE:', error.message);
    process.exit(1);
  }
}

setupCascadeDelete();
