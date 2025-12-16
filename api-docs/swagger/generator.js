/**
 * Modular Swagger Documentation Generator
 * Clean, maintainable, and extensible Swagger doc generation
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { swaggerConfig } from './config.js';
import { swaggerTags } from './tags.js';
import { swaggerDefinitions } from './definitions.js';
import { 
    generateMethodDoc, 
    getTagFromPath, 
    routeConfigs 
} from './pathGenerators.js';
import { 
    findRouteFiles, 
    extractRouteInfo, 
    validateSwaggerDoc, 
    generateApiSummary, 
    printApiSummary, 
    saveSwaggerDoc 
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Swagger Documentation Generator Class
 */
export class SwaggerGenerator {
    constructor(options = {}) {
        this.options = {
            routesDir: path.join(__dirname, '..', '..', 'routes'),
            outputFile: path.join(__dirname, '..', '..', 'swagger-output.json'),
            verbose: true,
            validateOutput: true,
            ...options
        };
        
        this.routeFiles = [];
        this.swaggerDoc = null;
    }

    /**
     * Generate complete Swagger documentation
     */
    async generate() {
        try {
            if (this.options.verbose) {
                console.log('🚀 Starting Swagger Documentation Generation');
                console.log('═'.repeat(60));
            }

            // Step 1: Discover route files
            await this.discoverRoutes();

            // Step 2: Generate base document
            this.generateBaseDocument();

            // Step 3: Generate paths from routes
            await this.generatePaths();

            // Step 4: Validate document
            if (this.options.validateOutput) {
                this.validateDocument();
            }

            // Step 5: Save document
            await this.saveDocument();

            // Step 6: Generate summary
            if (this.options.verbose) {
                this.printSummary();
            }

            return {
                success: true,
                document: this.swaggerDoc,
                outputFile: this.options.outputFile
            };

        } catch (error) {
            console.error('❌ Error generating Swagger documentation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Discover all route files in the routes directory
     */
    async discoverRoutes() {
        if (this.options.verbose) {
            console.log('🔍 Discovering route files...');
        }

        this.routeFiles = findRouteFiles(this.options.routesDir);

        if (this.options.verbose) {
            console.log(`📁 Found ${this.routeFiles.length} route files:`);
            this.routeFiles.forEach(file => {
                const relativePath = path.relative(path.join(__dirname, '..'), file);
                console.log(`   ✓ ${relativePath}`);
            });
        }

        if (this.routeFiles.length === 0) {
            throw new Error(`No route files found in ${this.options.routesDir}`);
        }
    }

    /**
     * Generate base Swagger document structure
     */
    generateBaseDocument() {
        if (this.options.verbose) {
            console.log('\n📋 Generating base document structure...');
        }

        this.swaggerDoc = {
            swagger: '2.0',
            ...swaggerConfig,
            tags: swaggerTags,
            definitions: swaggerDefinitions,
            paths: {}
        };
    }

    /**
     * Generate API paths from discovered route files
     */
    async generatePaths() {
        if (this.options.verbose) {
            console.log('\n🛣️  Generating API paths...');
        }

        const paths = {};
        let totalRoutes = 0;

        for (const filePath of this.routeFiles) {
            const routes = extractRouteInfo(filePath);
            const tag = getTagFromPath(filePath);

            if (this.options.verbose && routes.length > 0) {
                const relativePath = path.relative(path.join(__dirname, '..'), filePath);
                console.log(`   📄 Processing ${relativePath} (${routes.length} routes)`);
            }

            for (const route of routes) {
                const fullPath = this.buildFullPath(route.path);
                const method = route.method.toLowerCase();

                // Initialize path object if it doesn't exist
                if (!paths[fullPath]) {
                    paths[fullPath] = {};
                }

                // Get route-specific configuration
                const routeConfig = routeConfigs[route.path]?.[method] || {};

                // Generate method documentation
                paths[fullPath][method] = generateMethodDoc(
                    route.method, 
                    route.path, 
                    tag, 
                    routeConfig
                );

                totalRoutes++;
            }
        }

        this.swaggerDoc.paths = paths;

        if (this.options.verbose) {
            console.log(`   ✅ Generated ${totalRoutes} API endpoints`);
        }
    }

    /**
     * Build full API path with base path
     */
    buildFullPath(routePath) {
        // Handle root path
        if (routePath === '/') {
            return '/api/v1';
        }
        
        // Handle paths that already include /api/v1
        if (routePath.startsWith('/api/v1')) {
            return routePath;
        }
        
        // Add /api/v1 prefix
        return `/api/v1${routePath}`;
    }

    /**
     * Validate the generated Swagger document
     */
    validateDocument() {
        if (this.options.verbose) {
            console.log('\n🔍 Validating Swagger document...');
        }

        const validation = validateSwaggerDoc(this.swaggerDoc);

        if (!validation.isValid) {
            console.warn('⚠️  Swagger document validation warnings:');
            validation.errors.forEach(error => {
                console.warn(`   - ${error}`);
            });
        } else if (this.options.verbose) {
            console.log('   ✅ Document validation passed');
        }
    }

    /**
     * Save the generated Swagger document
     */
    async saveDocument() {
        if (this.options.verbose) {
            console.log('\n💾 Saving Swagger document...');
        }

        const result = saveSwaggerDoc(this.swaggerDoc, this.options.outputFile);

        if (result.success) {
            if (this.options.verbose) {
                console.log(`   ✅ Document saved to: ${result.path}`);
            }
        } else {
            throw new Error(`Failed to save document: ${result.error}`);
        }
    }

    /**
     * Print generation summary
     */
    printSummary() {
        console.log('\n🎉 Swagger Documentation Generated Successfully!');
        
        const summary = generateApiSummary(this.swaggerDoc);
        printApiSummary(summary);
        
        console.log(`\n🌐 View documentation at: http://localhost:8877/api-docs`);
        console.log(`📄 JSON schema at: ${this.options.outputFile}`);
    }

    /**
     * Get the generated Swagger document
     */
    getDocument() {
        return this.swaggerDoc;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.options = { ...this.options, ...newConfig };
    }
}

/**
 * Convenience function to generate Swagger documentation
 */
export async function generateSwaggerDoc(options = {}) {
    const generator = new SwaggerGenerator(options);
    return await generator.generate();
}

/**
 * Export for backward compatibility
 */
export { generateSwaggerDoc as default };
