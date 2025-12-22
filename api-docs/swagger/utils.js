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
 * Parse Swagger comments from file content for a specific route
 */
export function parseSwaggerComments(content, routePath, method) {
    try {
        const methodLower = method.toLowerCase();
        const escapedPath = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const routePattern = `router\\.${methodLower}\\s*\\(\\s*["'\`]${escapedPath}["'\`]`;
        
        // Find all occurrences of this route pattern
        const regex = new RegExp(routePattern, 'i');
        const matches = [...content.matchAll(regex)];
        if (matches.length === 0) return {};
        
        // Use the first match
        const match = matches[0];
        const routeStartIndex = match.index;
        
        // Get content before the route (up to 2000 chars) to find swagger comments
        // Look backwards to find the start of the route handler (previous router. or function start)
        let searchStart = Math.max(0, routeStartIndex - 2000);
        // Try to find the beginning of this route handler by looking for previous router. or async function
        const beforeRoute = content.substring(searchStart, routeStartIndex);
        const handlerStart = beforeRoute.lastIndexOf('router.') || beforeRoute.lastIndexOf('async');
        if (handlerStart > 0) {
            searchStart = routeStartIndex - (beforeRoute.length - handlerStart);
        }
        const routeBlock = content.substring(searchStart, routeStartIndex + 1000);
        
        const swaggerData = {};
        
        // Parse tags
        const tagsMatch = routeBlock.match(/\/\/\s*#swagger\.tags\s*=\s*\[(.*?)\]/);
        if (tagsMatch) {
            try {
                swaggerData.tags = JSON.parse(tagsMatch[1]);
            } catch (e) {}
        }
        
        // Parse summary
        const summaryMatch = routeBlock.match(/\/\/\s*#swagger\.summary\s*=\s*['"](.*?)['"]/);
        if (summaryMatch) {
            swaggerData.summary = summaryMatch[1];
        }
        
        // Parse description
        const descMatch = routeBlock.match(/\/\/\s*#swagger\.description\s*=\s*['"](.*?)['"]/);
        if (descMatch) {
            swaggerData.description = descMatch[1];
        }
        
        // Parse security
        const securityMatch = routeBlock.match(/\/\/\s*#swagger\.security\s*=\s*(\[.*?\])/);
        if (securityMatch) {
            try {
                swaggerData.security = JSON.parse(securityMatch[1]);
            } catch (e) {}
        }
        
        // Parse body parameters - look for example in schema
        const bodyParamRegex = /\/\*\s*#swagger\.parameters\['body'\]\s*=\s*\{([\s\S]*?)\}\s*\*\//;
        const bodyMatch = routeBlock.match(bodyParamRegex);
        if (bodyMatch) {
            const bodyContent = bodyMatch[1];
            
            // Extract schema block
            const schemaMatch = bodyContent.match(/schema:\s*\{([\s\S]*?)\}(?=\s*$|\s*\})/);
            if (schemaMatch) {
                const schemaContent = schemaMatch[1];
                
                // Extract properties
                const propsMatch = schemaContent.match(/properties:\s*\{([\s\S]*?)\}(?=\s*,|\s*example|\s*required|\s*\})/);
                let properties = {};
                if (propsMatch) {
                    try {
                        const propsContent = propsMatch[1];
                        // Extract each property: name: { type: 'string', example: 'value' }
                        const propRegex = /(\w+):\s*\{([^}]*?)\}/g;
                        let propMatch;
                        while ((propMatch = propRegex.exec(propsContent)) !== null) {
                            const propName = propMatch[1];
                            const propDef = propMatch[2];
                            const typeMatch = propDef.match(/type:\s*['"](.*?)['"]/);
                            const exampleMatch = propDef.match(/example:\s*['"](.*?)['"]/);
                            properties[propName] = {
                                type: typeMatch ? typeMatch[1] : 'string'
                            };
                            if (exampleMatch) {
                                properties[propName].example = exampleMatch[1];
                            }
                        }
                    } catch (e) {}
                }
                
                // Extract example from schema (look for example: { ... } inside schema)
                // Match example: { key: 'value', key2: 'value2' }
                const exampleMatch = schemaContent.match(/example:\s*\{([\s\S]*?)\}(?=\s*\}|\s*$)/);
                if (exampleMatch) {
                    try {
                        // Use Function constructor to safely parse JS object literal
                        const exampleStr = exampleMatch[1].trim();
                        // Clean up whitespace
                        const cleanStr = exampleStr.replace(/\s+/g, ' ').trim();
                        // Use Function constructor (safer than eval, but still be careful)
                        const exampleObj = new Function('return {' + cleanStr + '}')();
                        
                        swaggerData.bodySchema = {
                            type: 'object',
                            example: exampleObj
                        };
                        
                        if (Object.keys(properties).length > 0) {
                            swaggerData.bodySchema.properties = properties;
                        }
                        
                        // Extract required
                        const requiredMatch = schemaContent.match(/required:\s*\[(.*?)\]/);
                        if (requiredMatch) {
                            try {
                                const requiredStr = requiredMatch[1].replace(/'/g, '"');
                                swaggerData.bodySchema.required = JSON.parse('[' + requiredStr + ']');
                            } catch (e) {}
                        }
                    } catch (e) {
                        // If parsing fails, create schema with properties only
                        swaggerData.bodySchema = {
                            type: 'object',
                            properties: properties
                        };
                    }
                } else if (Object.keys(properties).length > 0) {
                    // If no example but we have properties, create schema from properties
                    swaggerData.bodySchema = {
                        type: 'object',
                        properties: properties
                    };
                }
            }
        }
        
        return swaggerData;
    } catch (error) {
        return {};
    }
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
            const swaggerData = parseSwaggerComments(content, route, method);
            routes.push({
                method: method.toUpperCase(),
                path: route,
                file: path.relative(path.join(__dirname, '..'), filePath),
                swagger: swaggerData
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
