/**
 * Verify Email Broadcast Tables Exist
 */

import pool from '../db.js';

async function verifyTables() {
  const tables = [
    'email_configs',
    'email_templates',
    'email_broadcasts',
    'email_broadcast_batches',
    'email_broadcast_logs'
  ];

  console.log('\n🔍 Verifying email broadcast tables...\n');

  const results = [];
  
  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [table]);
      if (rows.length > 0) {
        // Get row count
        const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        console.log(`✅ ${table} - EXISTS (${countRows[0].count} rows)`);
        results.push({ table, exists: true, count: countRows[0].count });
      } else {
        console.log(`❌ ${table} - DOES NOT EXIST`);
        results.push({ table, exists: false });
      }
    } catch (error) {
      console.log(`❌ ${table} - ERROR: ${error.message}`);
      results.push({ table, exists: false, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  const existing = results.filter(r => r.exists).length;
  const missing = results.filter(r => !r.exists).length;
  console.log(`📊 Summary: ${existing} exist, ${missing} missing`);
  console.log('='.repeat(50) + '\n');

  if (missing > 0) {
    console.log('⚠️  Some tables are missing. Run: npm run migrate\n');
    process.exit(1);
  } else {
    console.log('✅ All tables exist!\n');
    process.exit(0);
  }
}

verifyTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

