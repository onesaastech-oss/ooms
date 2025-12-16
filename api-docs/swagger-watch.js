import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSwaggerDoc } from './swagger/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isGenerating = false;
let timeout = null;

// Debounced function to regenerate docs
function regenerateDocs() {
    if (isGenerating) return;
    
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
        isGenerating = true;
        console.log('\n🔄 Route files changed, regenerating Swagger docs...');
        
        try {
            const result = await generateSwaggerDoc({ verbose: false });
            if (result.success) {
                console.log('✅ Documentation updated successfully!\n');
            } else {
                console.error('❌ Error generating documentation:', result.error);
            }
        } catch (error) {
            console.error('❌ Error generating documentation:', error.message);
        } finally {
            isGenerating = false;
        }
    }, 1000); // Wait 1 second after last change
}

// Watch routes directory for changes
function watchRoutes() {
    const routesDir = path.join(__dirname, '../routes');
    
    console.log('👀 Watching for route file changes...');
    console.log(`📁 Monitoring: ${routesDir}`);
    
    try {
        // Watch the routes directory recursively with error handling
        const watcher = fs.watch(routesDir, { recursive: true }, (eventType, filename) => {
            if (filename && (filename.endsWith('.js') || filename.includes('routes'))) {
                console.log(`📝 File changed: ${filename}`);
                regenerateDocs();
            }
        });
        
        // Handle watcher errors
        watcher.on('error', (error) => {
            console.error('❌ File watcher error:', error.message);
            console.log('🔄 Attempting to restart watcher...');
            setTimeout(() => {
                try {
                    watcher.close();
                    watchRoutes();
                } catch (e) {
                    console.error('❌ Failed to restart watcher:', e.message);
                }
            }, 2000);
        });
        
        console.log('✅ File watcher started. Press Ctrl+C to stop.\n');
        
        return watcher;
    } catch (error) {
        console.error('❌ Failed to start file watcher:', error.message);
        console.log('⚠️  Continuing without file watching...');
        return null;
    }
}

let watcher = null;

// Generate initial docs and start watching
console.log('🚀 Starting Swagger Auto-Generator with File Watcher\n');
generateSwaggerDoc({ verbose: true }).then(result => {
    if (result.success) {
        console.log('📚 Initial documentation generated\n');
        watcher = watchRoutes();
    } else {
        console.error('❌ Failed to generate initial documentation:', result.error);
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

// Handle graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n👋 Received ${signal}, stopping file watcher...`);
    if (watcher) {
        try {
            watcher.close();
            console.log('✅ File watcher stopped');
        } catch (error) {
            console.log('⚠️  Error stopping watcher:', error.message);
        }
    }
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
