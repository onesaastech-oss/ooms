/**
 * Swagger Path Generators
 * Functions to generate standardized API path documentation
 */

import { folderTagMapping } from './tags.js';

/**
 * Generate standard response schemas for different HTTP status codes
 */
export function getStandardResponses(customResponses = {}) {
    const standardResponses = {
        200: {
            description: 'Successful response',
            schema: { $ref: '#/definitions/ApiResponse' }
        },
        400: {
            description: 'Bad request - Invalid input parameters',
            schema: { $ref: '#/definitions/ErrorResponse' }
        },
        401: {
            description: 'Unauthorized - Authentication required',
            schema: { $ref: '#/definitions/ErrorResponse' }
        },
        403: {
            description: 'Forbidden - Insufficient permissions',
            schema: { $ref: '#/definitions/ErrorResponse' }
        },
        404: {
            description: 'Not found - Resource does not exist',
            schema: { $ref: '#/definitions/ErrorResponse' }
        },
        500: {
            description: 'Internal server error',
            schema: { $ref: '#/definitions/ErrorResponse' }
        }
    };

    return { ...standardResponses, ...customResponses };
}

/**
 * Generate parameters for encrypted request body
 */
export function getEncryptedBodyParameter(description = 'Encrypted request data') {
    return {
        name: 'body',
        in: 'body',
        required: true,
        description,
        schema: { $ref: '#/definitions/EncryptedRequest' }
    };
}

/**
 * Generate path parameters from route string
 */
export function extractPathParameters(routePath) {
    const pathParams = routePath.match(/:(\w+)/g);
    if (!pathParams) return [];

    return pathParams.map(param => {
        const paramName = param.substring(1);
        return {
            name: paramName,
            in: 'path',
            required: true,
            type: 'string',
            description: `${paramName.charAt(0).toUpperCase() + paramName.slice(1)} parameter`
        };
    });
}

/**
 * Generate query parameters for pagination
 */
export function getPaginationParameters() {
    return [
        {
            name: 'page_no',
            in: 'query',
            type: 'integer',
            minimum: 1,
            default: 1,
            description: 'Page number for pagination'
        },
        {
            name: 'limit',
            in: 'query',
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Number of items per page'
        },
        {
            name: 'query',
            in: 'query',
            type: 'string',
            description: 'Search query string'
        }
    ];
}

/**
 * Generate file upload parameters
 */
export function getFileUploadParameters() {
    return [
        {
            name: 'file',
            in: 'formData',
            type: 'file',
            required: true,
            description: 'File to upload (supports: images, videos, documents, audio)'
        }
    ];
}

/**
 * Generate authentication security requirement
 */
export function getAuthSecurity() {
    return [{ bearerAuth: [] }];
}

/**
 * Generate tag from file path using mapping
 */
export function getTagFromPath(filePath) {
    const pathParts = filePath.split('/');
    const folderName = pathParts.find(part => 
        Object.keys(folderTagMapping).includes(part)
    );
    
    if (folderName) {
        return folderTagMapping[folderName];
    }
    
    if (filePath.includes('index.js')) {
        return 'System';
    }
    
    return 'General';
}

/**
 * Generate method-specific documentation
 */
export function generateMethodDoc(method, route, tag, customConfig = {}) {
    const methodLower = method.toLowerCase();
    const isAuthRequired = customConfig.requiresAuth !== false && 
                          !route.includes('login') && 
                          !route.includes('health');
    
    const baseDoc = {
        tags: [tag],
        summary: customConfig.summary || `${method} ${route}`,
        description: customConfig.description || `${method} operation for ${route}`,
        responses: getStandardResponses(customConfig.responses || {})
    };

    // Add authentication if required
    if (isAuthRequired) {
        baseDoc.security = getAuthSecurity();
    }

    // Add parameters based on method and route
    const parameters = [];
    
    // Path parameters
    parameters.push(...extractPathParameters(route));
    
    // Method-specific parameters
    if (['post', 'put', 'patch'].includes(methodLower)) {
        if (customConfig.useEncryption !== false) {
            parameters.push(getEncryptedBodyParameter());
        } else if (customConfig.bodySchema) {
            parameters.push({
                name: 'body',
                in: 'body',
                required: true,
                schema: customConfig.bodySchema
            });
        }
    }
    
    // File upload parameters
    if (route.includes('upload') && methodLower === 'post') {
        parameters.push(...getFileUploadParameters());
        baseDoc.consumes = ['multipart/form-data'];
    }
    
    // Pagination parameters for list endpoints
    if (route.includes('list') || route.includes('search')) {
        parameters.push(...getPaginationParameters());
    }
    
    if (parameters.length > 0) {
        baseDoc.parameters = parameters;
    }

    return baseDoc;
}

/**
 * Route-specific configurations for better documentation
 */
export const routeConfigs = {
    // Authentication routes
    '/login/send-otp': {
        post: {
            summary: 'Send OTP for login',
            description: 'Send a one-time password to user email for login verification',
            requiresAuth: false,
            useEncryption: false,
            bodySchema: { $ref: '#/definitions/LoginRequest' },
            responses: {
                200: {
                    description: 'OTP sent successfully',
                    schema: { $ref: '#/definitions/ApiResponse' }
                }
            }
        }
    },
    '/login/email': {
        post: {
            summary: 'Login with email and OTP',
            description: 'Complete login process using email, password, and OTP',
            requiresAuth: false,
            useEncryption: false,
            bodySchema: { $ref: '#/definitions/LoginOTPRequest' },
            responses: {
                200: {
                    description: 'Login successful',
                    schema: { $ref: '#/definitions/AuthResponse' }
                }
            }
        }
    },
    '/google-login': {
        post: {
            summary: 'Google OAuth login',
            description: 'Authenticate user using Google OAuth token',
            requiresAuth: false
        }
    },
    '/google-register': {
        post: {
            summary: 'Google OAuth registration',
            description: 'Register new user using Google OAuth token',
            requiresAuth: false
        }
    },
    
    // Upload routes
    '/upload-media': {
        post: {
            summary: 'Upload media file',
            description: 'Upload and process media files with automatic format conversion',
            responses: {
                200: {
                    description: 'File uploaded successfully',
                    schema: { $ref: '#/definitions/FileUploadResponse' }
                }
            }
        }
    },
    
    // Media serving routes
    '/upload/:filename': {
        get: {
            summary: 'Serve uploaded file',
            description: 'Retrieve and serve uploaded media files with streaming support',
            requiresAuth: false,
            responses: {
                200: {
                    description: 'File content',
                    schema: { type: 'file' }
                },
                206: {
                    description: 'Partial content (for video streaming)'
                }
            }
        }
    },
    '/error/:filename': {
        get: {
            summary: 'Serve error file',
            description: 'Retrieve error-related media files',
            requiresAuth: false
        }
    },
    
    // Task routes
    '/contact-list': {
        post: {
            summary: 'Get contact list',
            description: 'Retrieve paginated list of contacts with search functionality',
            responses: {
                200: {
                    description: 'Contact list retrieved successfully',
                    schema: { $ref: '#/definitions/ContactListResponse' }
                }
            }
        }
    },
    
    // Health check
    '/health': {
        get: {
            summary: 'Health check',
            description: 'Check system health and status',
            requiresAuth: false,
            responses: {
                200: {
                    description: 'System is healthy',
                    schema: { $ref: '#/definitions/HealthResponse' }
                }
            }
        }
    }
};
