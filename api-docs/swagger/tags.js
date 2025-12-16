/**
 * Swagger Tags Configuration
 * Defines API endpoint categories and descriptions
 */

export const swaggerTags = [
    {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints including login, OTP verification, and Google OAuth'
    },
    {
        name: 'Clients',
        description: 'Client management operations for handling customer data and relationships'
    },
    {
        name: 'Tasks',
        description: 'Task and contact management system for organizing work and communications'
    },
    {
        name: 'Upload',
        description: 'File upload and processing endpoints supporting multiple formats with automatic conversion'
    },
    {
        name: 'Media',
        description: 'Media file serving and streaming endpoints with support for video range requests'
    },
    {
        name: 'System',
        description: 'System health monitoring and administrative endpoints'
    },
    {
        name: 'Settings',
        description: 'Application settings and configuration management'
    },
    {
        name: 'General',
        description: 'General purpose endpoints and utilities'
    }
];

/**
 * Maps folder names to tag names for automatic categorization
 */
export const folderTagMapping = {
    'auth': 'Authentication',
    'clients': 'Clients', 
    'tasks': 'Tasks',
    'uploads': 'Upload',
    'media': 'Media',
    'settings': 'Settings',
    'system': 'System'
};
