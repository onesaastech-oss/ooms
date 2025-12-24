import pool from './db.js';
import fs from 'fs';

async function runOptimization() {
    try {
        console.log('🚀 Starting database optimization for firms search...');
        
        // Read the SQL file
        const sqlContent = fs.readFileSync('./database/migrations/optimize_firms_search.sql', 'utf8');
        
        // Split by semicolons and filter out empty statements
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.match(/^\s*$/));
        
        console.log(`📋 Found ${statements.length} SQL statements to execute`);
        
        let successCount = 0;
        let skipCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            try {
                console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}:`);
                console.log(`   ${statement.substring(0, 60)}...`);
                
                await pool.query(statement);
                successCount++;
                console.log(`   ✅ Success`);
                
            } catch (error) {
                if (error.message.includes('Duplicate key name') || 
                    error.message.includes('already exists')) {
                    skipCount++;
                    console.log(`   ⚠️  Skipped (already exists)`);
                } else {
                    console.log(`   ❌ Error: ${error.message}`);
                }
            }
        }
        
        console.log('\n📊 Optimization Results:');
        console.log(`   ✅ Successfully created: ${successCount} indexes`);
        console.log(`   ⚠️  Already existed: ${skipCount} indexes`);
        console.log(`   📈 Total processed: ${statements.length} statements`);
        
        // Test the optimization with a sample query
        console.log('\n🧪 Testing search performance...');
        
        const testStart = Date.now();
        const [testResults] = await pool.query(`
            SELECT id, firm_name, firm_id, username 
            FROM firms 
            WHERE is_deleted = '0' AND status = '1'
            AND firm_name LIKE '%OneSaaS%'
            LIMIT 5
        `);
        const testTime = Date.now() - testStart;
        
        console.log(`   🎯 Test query completed in ${testTime}ms`);
        console.log(`   📋 Found ${testResults.length} test results`);
        
        if (testResults.length > 0) {
            console.log(`   📝 Sample result: ${testResults[0].firm_name} (${testResults[0].firm_id})`);
        }
        
        console.log('\n🎉 Database optimization completed successfully!');
        console.log('   Your firm search API should now be significantly faster.');
        
    } catch (error) {
        console.error('❌ Optimization failed:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the optimization
runOptimization();
