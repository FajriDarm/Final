const db = require('../config/database');

async function setupCascadeDelete() {
  try {
    console.log('Setting up CASCADE DELETE for all event-related foreign keys...\n');

    // 1. affiliate_links → events
    console.log('1. Updating affiliate_links foreign key...');
    await db.query('ALTER TABLE affiliate_links DROP FOREIGN KEY affiliate_links_ibfk_2');
    await db.query(`
      ALTER TABLE affiliate_links 
      ADD CONSTRAINT fk_affiliate_links_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ affiliate_links updated');

    // 2. affiliate_referrals → events
    console.log('2. Updating affiliate_referrals foreign key...');
    await db.query('ALTER TABLE affiliate_referrals DROP FOREIGN KEY affiliate_referrals_ibfk_2');
    await db.query(`
      ALTER TABLE affiliate_referrals 
      ADD CONSTRAINT fk_affiliate_referrals_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ affiliate_referrals updated');

    // 3. transactions → events
    console.log('3. Updating transactions → events foreign key...');
    await db.query('ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_1');
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_event_id 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    `);
    console.log('✓ transactions updated');

    // 4. payment_proofs → transactions
    console.log('4. Updating payment_proofs → transactions foreign key...');
    await db.query('ALTER TABLE payment_proofs DROP FOREIGN KEY payment_proofs_ibfk_1');
    await db.query(`
      ALTER TABLE payment_proofs 
      ADD CONSTRAINT fk_payment_proofs_transaction_id 
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    `);
    console.log('✓ payment_proofs updated');

    // 5. verifications → transactions
    console.log('5. Updating verifications → transactions foreign key...');
    await db.query('ALTER TABLE verifications DROP FOREIGN KEY verifications_ibfk_1');
    await db.query(`
      ALTER TABLE verifications 
      ADD CONSTRAINT fk_verifications_transaction_id 
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    `);
    console.log('✓ verifications updated');

    // 6. commissions → transactions
    console.log('6. Updating commissions → transactions foreign key...');
    await db.query('ALTER TABLE commissions DROP FOREIGN KEY commissions_ibfk_1');
    await db.query(`
      ALTER TABLE commissions 
      ADD CONSTRAINT fk_commissions_transaction_id 
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    `);
    console.log('✓ commissions updated');

    // 7. payout_details → commissions
    console.log('7. Updating payout_details → commissions foreign key...');
    await db.query('ALTER TABLE payout_details DROP FOREIGN KEY payout_details_ibfk_2');
    await db.query(`
      ALTER TABLE payout_details 
      ADD CONSTRAINT fk_payout_details_commission_id 
      FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE
    `);
    console.log('✓ payout_details updated');

    console.log('\n✅ CASCADE DELETE setup completed successfully!');
    console.log('Now you can delete events without foreign key errors.');
    console.log('All related data (transactions, commissions, proofs, etc.) will be deleted automatically.');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up CASCADE DELETE:', error.message);
    process.exit(1);
  }
}

setupCascadeDelete();
