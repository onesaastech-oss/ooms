/**
 * Swagger Utilities
 * Helper functions for Swagger documentation generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively find all route files in the routes directory
 */
export function findRouteFiles(dir, routeFiles = []) {
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                // Recursively search subdirectories
                findRouteFiles(filePath, routeFiles);
            } else if (file.endsWith('.routes.js') || file === 'index.js') {
                routeFiles.push(filePath);
            }
        }
    } catch (error) {
        console.warn(`Warning: Could not read directory ${dir}:`, error.message);
    }
    
    return routeFiles;
}

/**
 * Extract route information from a route file
 */
export function extractRouteInfo(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const routes = [];
        
        // Extract router methods (get, post, put, delete, patch)
        const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g;
        let match;
        
        while ((match = routeRegex.exec(content)) !== null) {
            const [, method, route] = match;
            routes.push({
                method: method.toUpperCase(),
                path: route,
                file: path.relative(path.join(__dirname, '..'), filePath)
            });
        }
        
        return routes;
    } catch (error) {
        console.warn(`Warning: Could not read route file ${filePath}:`, error.message);
        return [];
    }
}

/**
 * Validate Swagger document structure
 */
export function validateSwaggerDoc(swaggerDoc) {
    const errors = [];
    
    // Check required fields
    if (!swaggerDoc.info) {
        errors.push('Missing required field: info');
    }
    
    if (!swaggerDoc.paths) {
        errors.push('Missing required field: paths');
    }
    
    // Check info object
    if (swaggerDoc.info) {
        if (!swaggerDoc.info.title) {
            errors.push('Missing required field: info.title');
        }
        if (!swaggerDoc.info.version) {
            errors.push('Missing required field: info.version');
        }
    }
    
    // Validate paths
    if (swaggerDoc.paths) {
        for (const [pathKey, pathValue] of Object.entries(swaggerDoc.paths)) {
            if (!pathKey.startsWith('/')) {
                errors.push(`Invalid path key: ${pathKey} (must start with /)`);
            }
            
            for (const [method, methodValue] of Object.entries(pathValue)) {
                const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
                if (!validMethods.includes(method.toLowerCase())) {
                    errors.push(`Invalid HTTP method: ${method} in path ${pathKey}`);
                }
                
                if (!methodValue.responses) {
                    errors.push(`Missing responses for ${method.toUpperCase()} ${pathKey}`);
                }
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Generate a summary report of the API documentation
 */
export function generateApiSummary(swaggerDoc) {
    const summary = {
        title: swaggerDoc.info?.title || 'Unknown API',
        version: swaggerDoc.info?.version || 'Unknown',
        totalPaths: 0,
        totalOperations: 0,
        methodCounts: {},
        tagCounts: {},
        securedEndpoints: 0
    };
    
    if (swaggerDoc.paths) {
        summary.totalPaths = Object.keys(swaggerDoc.paths).length;
        
        for (const pathValue of Object.values(swaggerDoc.paths)) {
            for (const [method, methodValue] of Object.entries(pathValue)) {
                summary.totalOperations++;
                
                // Count methods
                const methodUpper = method.toUpperCase();
                summary.methodCounts[methodUpper] = (summary.methodCounts[methodUpper] || 0) + 1;
                
                // Count tags
                if (methodValue.tags) {
                    for (const tag of methodValue.tags) {
                        summary.tagCounts[tag] = (summary.tagCounts[tag] || 0) + 1;
                    }
                }
                
                // Count secured endpoints
                if (methodValue.security) {
                    summary.securedEndpoints++;
                }
            }
        }
    }
    
    return summary;
}

/**
 * Pretty print API summary to console
 */
export function printApiSummary(summary) {
    console.log('\n📊 API Documentation Summary');
    console.log('═'.repeat(50));
    console.log(`📋 Title: ${summary.title}`);
    console.log(`🏷️  Version: ${summary.version}`);
    console.log(`🛣️  Total Paths: ${summary.totalPaths}`);
    console.log(`⚡ Total Operations: ${summary.totalOperations}`);
    console.log(`🔒 Secured Endpoints: ${summary.securedEndpoints}`);
    
    console.log('\n📈 Methods Distribution:');
    for (const [method, count] of Object.entries(summary.methodCounts)) {
        console.log(`   ${method}: ${count}`);
    }
    
    console.log('\n🏷️  Tags Distribution:');
    for (const [tag, count] of Object.entries(summary.tagCounts)) {
        console.log(`   ${tag}: ${count}`);
    }
    console.log('═'.repeat(50));
}

/**
 * Save Swagger document
 */
export function saveSwaggerDoc(swaggerDoc, outputPath) {
    try {
        // Write new document
        fs.writeFileSync(outputPath, JSON.stringify(swaggerDoc, null, 2));
        
        return { success: true, path: outputPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Load existing Swagger document
 */
export function loadSwaggerDoc(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`Could not load existing Swagger doc from ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Merge two Swagger documents
 */
export function mergeSwaggerDocs(baseDoc, newDoc) {
    return {
        ...baseDoc,
        ...newDoc,
        info: { ...baseDoc.info, ...newDoc.info },
        paths: { ...baseDoc.paths, ...newDoc.paths },
        definitions: { ...baseDoc.definitions, ...newDoc.definitions },
        tags: [...(baseDoc.tags || []), ...(newDoc.tags || [])].filter(
            (tag, index, self) => index === self.findIndex(t => t.name === tag.name)
        )
    };
}
