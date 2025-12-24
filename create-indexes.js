import pool from './db.js';

async function createIndexes() {
    console.log('🚀 Creating optimized indexes for firms search...\n');
    
    const indexes = [
        {
            name: 'Primary autocomplete index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_autocomplete_primary 
                  ON firms (is_deleted, status, firm_name(20))`
        },
        {
            name: 'Secondary autocomplete index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_autocomplete_secondary 
                  ON firms (is_deleted, status, firm_id)`
        },
        {
            name: 'Composite search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_search_optimized 
                  ON firms (is_deleted, status, firm_name, firm_id, username)`
        },
        {
            name: 'Prefix search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_name_prefix 
                  ON firms (firm_name(10), is_deleted, status)`
        },
        {
            name: 'Branch search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_branch_search 
                  ON firms (branch_id, is_deleted, status, firm_name(15))`
        },
        {
            name: 'Branch filter index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_branch 
                  ON firms (branch_id, is_deleted, status)`
        },
        {
            name: 'GST search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_gst 
                  ON firms (gst_no, is_deleted)`
        },
        {
            name: 'PAN search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_pan 
                  ON firms (pan_no, is_deleted)`
        },
        {
            name: 'Location search index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_location 
                  ON firms (city, state, is_deleted)`
        },
        {
            name: 'Creation date index',
            sql: `CREATE INDEX IF NOT EXISTS idx_firms_create_date 
                  ON firms (create_date, is_deleted)`
        }
    ];
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < indexes.length; i++) {
        const index = indexes[i];
        
        try {
            console.log(`⚡ Creating ${index.name}...`);
            await pool.query(index.sql);
            successCount++;
            console.log(`   ✅ Success\n`);
            
        } catch (error) {
            if (error.message.includes('Duplicate key name') || 
                error.message.includes('already exists')) {
                skipCount++;
                console.log(`   ⚠️  Already exists\n`);
            } else {
                errorCount++;
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }
    }
    
    // Try to create FULLTEXT index (may not be supported in all MariaDB versions)
    try {
        console.log(`⚡ Creating FULLTEXT search index...`);
        await pool.query(`
            CREATE FULLTEXT INDEX IF NOT EXISTS idx_firms_fulltext 
            ON firms (firm_name, username, firm_type)
        `);
        successCount++;
        console.log(`   ✅ Success\n`);
    } catch (error) {
        if (error.message.includes('Duplicate key name')) {
            skipCount++;
            console.log(`   ⚠️  Already exists\n`);
        } else {
            console.log(`   ⚠️  FULLTEXT not supported: ${error.message}\n`);
        }
    }
    
    console.log('📊 Index Creation Results:');
    console.log(`   ✅ Successfully created: ${successCount} indexes`);
    console.log(`   ⚠️  Already existed: ${skipCount} indexes`);
    console.log(`   ❌ Errors: ${errorCount} indexes`);
    
    // Test search performance
    console.log('\n🧪 Testing optimized search performance...');
    
    const testQueries = [
        { name: 'Firm name search', sql: `SELECT COUNT(*) as count FROM firms WHERE is_deleted = '0' AND status = '1' AND firm_name LIKE '%OneSaaS%'` },
        { name: 'Firm ID search', sql: `SELECT COUNT(*) as count FROM firms WHERE is_deleted = '0' AND status = '1' AND firm_id LIKE '379012%'` },
        { name: 'Username search', sql: `SELECT COUNT(*) as count FROM firms WHERE is_deleted = '0' AND status = '1' AND username LIKE '123456%'` }
    ];
    
    for (const testQuery of testQueries) {
        const start = Date.now();
        const [result] = await pool.query(testQuery.sql);
        const time = Date.now() - start;
        console.log(`   🎯 ${testQuery.name}: ${time}ms (${result[0].count} results)`);
    }
    
    console.log('\n🎉 Database optimization completed!');
    console.log('   Your firm search API is now optimized for maximum performance.');
    
    await pool.end();
}

createIndexes().catch(console.error);
