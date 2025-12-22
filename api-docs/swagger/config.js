/**
 * Swagger Configuration
 * Base configuration for API documentation
 */

export const swaggerConfig = {
    info: {
        title: 'OOMS API',
        description: 'Order Management System API Documentation - A comprehensive REST API for managing orders, clients, tasks, and media files.',
        version: '1.0.0',
        contact: {
            name: 'OOMS API Support',
            email: 'support@ooms.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    host: 'api.ooms.in/',
    basePath: '/api/v1',
    schemes: ['http', 'https'],
    consumes: ['application/json', 'multipart/form-data'],
    produces: ['application/json'],
    securityDefinitions: {
        bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Bearer token for authentication (Format: Bearer <your-token>)'
        }
    }
};

export const swaggerOptions = {
    explorer: true,
    customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #3b82f6; }
    `,
    customSiteTitle: 'OOMS API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
    }
};
