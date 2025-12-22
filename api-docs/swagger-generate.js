#!/usr/bin/env node
/**
 * Swagger Documentation Generator
 * Single entry point for generating API documentation
 */

import { generateSwaggerDoc } from './swagger/index.js';

const args = process.argv.slice(2);
const isWatchMode = args.includes('--watch') || args.includes('-w');
const isVerbose = args.includes('--verbose') || args.includes('-v');

if (isWatchMode) {
    // Start watch mode
    console.log('🚀 Starting Swagger Auto-Generator with File Watcher\n');
    await import('./swagger-watch.js');
} else {
    // Generate documentation once
    console.log('🔄 Generating Swagger documentation...\n');
    
    try {
        const result = await generateSwaggerDoc({ 
            verbose: isVerbose,
            validateOutput: true 
        });
        
        if (result.success) {
            console.log('✅ Swagger documentation generated successfully!');
            console.log(`📄 Documentation saved to: swagger-output.json`);
            console.log(`🌐 View at: http://localhost:8877/api-docs\n`);
            process.exit(0);
        } else {
            console.error('❌ Failed to generate documentation:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
