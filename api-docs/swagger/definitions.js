/**
 * Swagger Schema Definitions
 * Reusable data models and response schemas
 */

export const swaggerDefinitions = {
    // Base Response Models
    ApiResponse: {
        type: 'object',
        properties: {
            success: { 
                type: 'boolean', 
                description: 'Indicates if the request was successful' 
            },
            message: { 
                type: 'string', 
                description: 'Human-readable response message' 
            },
            data: { 
                type: 'object', 
                description: 'Response data payload' 
            },
            timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp'
            }
        },
        required: ['success', 'message']
    },

    ErrorResponse: {
        type: 'object',
        properties: {
            error: { 
                type: 'boolean', 
                description: 'Indicates an error occurred',
                example: true
            },
            message: { 
                type: 'string', 
                description: 'Error description' 
            },
            code: {
                type: 'string',
                description: 'Error code for programmatic handling'
            }
        },
        required: ['error', 'message']
    },

    // Authentication Models
    LoginRequest: {
        type: 'object',
        properties: {
            email: { 
                type: 'string', 
                format: 'email',
                description: 'User email address',
                example: 'user@example.com'
            },
            password: { 
                type: 'string', 
                minLength: 6,
                description: 'User password',
                example: 'password123'
            }
        },
        required: ['email', 'password']
    },

    LoginOTPRequest: {
        type: 'object',
        properties: {
            email: { 
                type: 'string', 
                format: 'email',
                description: 'User email address'
            },
            password: { 
                type: 'string', 
                description: 'User password' 
            },
            otp: { 
                type: 'string', 
                pattern: '^[0-9]{6}$',
                description: '6-digit OTP code',
                example: '123456'
            }
        },
        required: ['email', 'password', 'otp']
    },

    AuthResponse: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            token: { 
                type: 'string', 
                description: 'JWT authentication token' 
            },
            expire_date: { 
                type: 'integer', 
                description: 'Token expiration timestamp' 
            },
            user: { $ref: '#/definitions/User' }
        }
    },

    // Settings / Staff Models
    CreateStaffRequest: {
        type: 'object',
        properties: {
            username: {
                type: 'string',
                description: 'Existing username to map to a branch (optional if email provided)',
                example: 'john_doe'
            },
            email: {
                type: 'string',
                format: 'email',
                description: 'Existing user email/login_id used to resolve username (optional if username provided)',
                example: 'john@example.com'
            },
            branch_id: {
                type: 'string',
                description: 'Branch identifier',
                example: 'BRANCH_001'
            },
            designation: {
                type: 'string',
                description: 'Staff designation/title',
                example: 'Sales Executive'
            },
            permission: {
                type: 'string',
                description: 'Role/type stored in branch_mapping.type (preferred over type)',
                example: 'staff'
            },
            type: {
                type: 'string',
                description: 'Role/type stored in branch_mapping.type (fallback if permission not provided)',
                example: 'staff'
            }
        },
        required: ['branch_id']
    },

    AssignStaffRequest: {
        type: 'object',
        properties: {
            username: {
                type: 'string',
                description: 'Existing username to map to a branch',
                example: 'john_doe'
            },
            branch_id: {
                type: 'string',
                description: 'Branch identifier',
                example: 'BRANCH_001'
            },
            designation: {
                type: 'string',
                description: 'Staff designation/title',
                example: 'Sales Executive'
            },
            type: {
                type: 'string',
                description: 'Role/type stored in branch_mapping.type',
                example: 'staff'
            }
        },
        required: ['username', 'branch_id']
    },

    // User Models
    User: {
        type: 'object',
        properties: {
            username: { 
                type: 'string', 
                description: 'Unique username' 
            },
            email: { 
                type: 'string', 
                format: 'email',
                description: 'User email address' 
            },
            name: { 
                type: 'string', 
                description: 'Full name' 
            },
            status: { 
                type: 'string', 
                enum: ['0', '1'],
                description: 'User status (0=inactive, 1=active)' 
            },
            country_code: { 
                type: 'string', 
                description: 'Country code for phone number' 
            },
            mobile: { 
                type: 'string', 
                description: 'Mobile phone number' 
            }
        }
    },

    // File Upload Models
    FileUploadResponse: {
        type: 'object',
        properties: {
            error: { 
                type: 'boolean', 
                description: 'Upload error status' 
            },
            link: { 
                type: 'string', 
                format: 'uri',
                description: 'URL to access the uploaded file' 
            },
            filename: {
                type: 'string',
                description: 'Generated filename on server'
            },
            originalName: {
                type: 'string', 
                description: 'Original uploaded filename'
            },
            size: {
                type: 'integer',
                description: 'File size in bytes'
            },
            mimeType: {
                type: 'string',
                description: 'File MIME type'
            }
        }
    },

    // Contact Models
    Contact: {
        type: 'object',
        properties: {
            contact_id: { 
                type: 'string', 
                description: 'Unique contact identifier' 
            },
            name: { 
                type: 'string', 
                description: 'Contact full name' 
            },
            number: { 
                type: 'string', 
                description: 'Contact phone number' 
            },
            email: { 
                type: 'string', 
                format: 'email',
                description: 'Contact email address' 
            },
            website: { 
                type: 'string', 
                format: 'uri',
                description: 'Contact website URL' 
            },
            firm_name: { 
                type: 'string', 
                description: 'Company or firm name' 
            },
            remark: { 
                type: 'string', 
                description: 'Additional notes or remarks' 
            },
            assign_to_me: { 
                type: 'boolean', 
                description: 'Whether contact is assigned to current user' 
            }
        }
    },

    ContactListResponse: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/definitions/Contact' }
            },
            count: { 
                type: 'integer', 
                description: 'Number of contacts returned' 
            },
            page_no: { 
                type: 'integer', 
                description: 'Current page number' 
            },
            is_last_page: { 
                type: 'boolean', 
                description: 'Whether this is the last page' 
            }
        }
    },

    // Health Check Models
    HealthResponse: {
        type: 'object',
        properties: {
            status: { 
                type: 'string', 
                enum: ['ok', 'error'],
                description: 'System health status' 
            },
            timestamp: { 
                type: 'string', 
                format: 'date-time',
                description: 'Health check timestamp' 
            },
            uptime: {
                type: 'number',
                description: 'Server uptime in seconds'
            },
            memory: {
                type: 'object',
                properties: {
                    used: { type: 'number' },
                    total: { type: 'number' }
                }
            }
        }
    }
};
