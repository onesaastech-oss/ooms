/**
 * Swagger Documentation System
 * Main entry point for the modular Swagger system
 */

export { SwaggerGenerator, generateSwaggerDoc } from './generator.js';
export { swaggerConfig, swaggerOptions } from './config.js';
export { swaggerTags, folderTagMapping } from './tags.js';
export { swaggerDefinitions } from './definitions.js';
export * from './pathGenerators.js';
export * from './utils.js';

// Re-export for convenience
import { generateSwaggerDoc } from './generator.js';
export default generateSwaggerDoc;
