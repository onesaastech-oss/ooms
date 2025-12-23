/**
 * Database Migration Runner
 * Executes SQL migration files
 */

import fs from 'fs';
import path from 'path';
import pool from '../db.js';

async function runMigration(filePath) {
  try {
    console.log(`\n📦 Running migration: ${path.basename(filePath)}`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Better SQL parsing - handle multi-line statements and ON DUPLICATE KEY UPDATE
    // Remove comments first
    let cleanSql = sql.replace(/--.*$/gm, '').trim();
    
    // Split by semicolon, but be smarter about it
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < cleanSql.length; i++) {
      const char = cleanSql[i];
      const nextChar = cleanSql[i + 1];
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && (i === 0 || cleanSql[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
      
      currentStatement += char;
      
      // If we hit a semicolon and we're not in a string, it's the end of a statement
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`   Found ${statements.length} SQL statement(s)`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.length === 0) continue;
      
      try {
        await pool.query(statement);
        successCount++;
      } catch (error) {
        // Some errors are acceptable (like table already exists, duplicate key)
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_ENTRY' ||
            error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⚠️  Statement ${i + 1}: ${error.code} (acceptable)`);
          successCount++;
        } else {
          console.error(`   ❌ Statement ${i + 1} failed: ${error.code}`);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
          console.error(`   Error: ${error.message}`);
          failCount++;
        }
      }
    }
    
    console.log(`   ✅ Successful: ${successCount}, ❌ Failed: ${failCount}`);
    console.log(`✅ Migration completed: ${path.basename(filePath)}`);
    return { success: failCount === 0, file: filePath };
  } catch (error) {
    console.error(`❌ Migration failed: ${path.basename(filePath)}`);
    console.error(error.message);
    console.error(error.stack);
    return { success: false, file: filePath, error: error.message };
  }
}

async function runAllMigrations() {
  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found');
    return;
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  console.log(`\n🚀 Starting database migrations...`);
  console.log(`Found ${files.length} migration file(s)\n`);
  
  const results = [];
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const result = await runMigration(filePath);
    results.push(result);
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Migration Summary:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  process.exit(0);
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});

