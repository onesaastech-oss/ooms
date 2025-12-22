import express from 'express';
const router = express.Router();

import pool from "../../db.js";
// import { auth } from "../../middleware/auth.js";
// import { RANDOM_STRING, UNIX_TIMESTAMP } from "../../helpers/function.js";





router.get('/list', async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Get permission roles list'
    // #swagger.description = 'Retrieve all permission roles (Admin, Manager, Employee, etc.) with their assigned permissions. Optionally filter by branch_id.'
    /* #swagger.parameters['branch_id'] = {
        in: 'query',
        description: 'Optional branch ID to filter permission roles',
        required: false,
        type: 'string',
        example: '565655',
        examples: {
            'All Roles': {
                value: null,
                summary: 'Get all permission roles'
            },
            'Filter by Branch': {
                value: '565655',
                summary: 'Get roles for specific branch'
            }
        }
    } */
    /* #swagger.responses[200] = {
        description: 'Permission roles retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true
                },
                message: {
                    type: 'string',
                    example: 'Permission roles retrieved successfully'
                },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'integer',
                                example: 1
                            },
                            branch_id: {
                                type: 'string',
                                example: '565655'
                            },
                            permission_role_id: {
                                type: 'string',
                                example: '25225'
                            },
                            name: {
                                type: 'string',
                                example: 'Admin'
                            },
                            permissions: {
                                type: 'object',
                                description: 'Parsed JSON permissions object',
                                example: {
                                    permissions: [
                                        {
                                            p_option_id: 1000,
                                            name: 'View Dashboard',
                                            status: '1'
                                        }
                                    ]
                                }
                            },
                            remark: {
                                type: 'string',
                                example: 'Administrator role with full access'
                            },
                            create_date: {
                                type: 'string',
                                example: '2025-12-18 14:24:19'
                            },
                            create_by: {
                                type: 'string',
                                example: 'admin'
                            },
                            modify_date: {
                                type: 'string',
                                example: '2025-12-18 09:27:19'
                            },
                            modify_by: {
                                type: 'string',
                                example: 'admin'
                            }
                        }
                    }
                },
                total: {
                    type: 'integer',
                    example: 2
                }
            }
        }
    } */
    /* #swagger.responses[500] = {
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: false
                },
                message: {
                    type: 'string',
                    example: 'Failed to retrieve permission roles'
                },
                error: {
                    type: 'string',
                    example: 'Error message details'
                }
            }
        }
    } */
    try {
        const { branch_id } = req.query;
        
        let query = "SELECT id, branch_id, permission_role_id, name, permissions_assigned, remark, create_date, create_by, modify_date, modify_by FROM permission_role";
        let params = [];
        
        // Optionally filter by branch_id if provided
        if (branch_id) {
            query += " WHERE branch_id = ?";
            params.push(branch_id);
        }
        
        query += " ORDER BY name ASC";
        
        const [rows] = await pool.query(query, params);
        
        // Parse permissions_assigned JSON for each role
        const rolesWithPermissions = rows.map(role => {
            let permissions = null;
            
            // Try to parse the permissions_assigned JSON string
            if (role.permissions_assigned) {
                try {
                    permissions = typeof role.permissions_assigned === 'string' 
                        ? JSON.parse(role.permissions_assigned) 
                        : role.permissions_assigned;
                } catch (parseError) {
                    console.warn(`Failed to parse permissions for role ${role.name}:`, parseError);
                    permissions = null;
                }
            }
            
            return {
                id: role.id,
                branch_id: role.branch_id,
                permission_role_id: role.permission_role_id,
                name: role.name,
                permissions: permissions,
                remark: role.remark,
                create_date: role.create_date,
                create_by: role.create_by,
                modify_date: role.modify_date,
                modify_by: role.modify_by
            };
        });
        
        res.status(200).json({
            success: true,
            message: 'Permission roles retrieved successfully',
            data: rolesWithPermissions,
            total: rolesWithPermissions.length
        });
    } catch (error) {
        console.error('Error fetching permission roles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve permission roles',
            error: error.message
        });
    }
});
router.get('/options', async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Get permission options list'
    // #swagger.description = 'Retrieve all available permission options that can be assigned to roles. Optionally filter by branch_id.'
    /* #swagger.parameters['branch_id'] = {
        in: 'query',
        description: 'Optional branch ID to filter permission options',
        required: false,
        type: 'string',
        example: '565655',
        examples: {
            'All Options': {
                value: null,
                summary: 'Get all permission options'
            },
            'Filter by Branch': {
                value: '565655',
                summary: 'Get options for specific branch'
            }
        }
    } */
    /* #swagger.responses[200] = {
        description: 'Permission options retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true
                },
                message: {
                    type: 'string',
                    example: 'Permission options retrieved successfully'
                },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'integer',
                                example: 1
                            },
                            p_option_id: {
                                type: 'integer',
                                example: 1000
                            },
                            name: {
                                type: 'string',
                                example: 'View Dashboard'
                            },
                            status: {
                                type: 'string',
                                example: '1'
                            }
                        }
                    }
                },
                total: {
                    type: 'integer',
                    example: 10
                }
            }
        }
    } */
    /* #swagger.responses[500] = {
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: false
                },
                message: {
                    type: 'string',
                    example: 'Failed to retrieve permission roles'
                },
                error: {
                    type: 'string',
                    example: 'Error message details'
                }
            }
        }
    } */
    try {
        const { branch_id } = req.query;
        
        let query = "SELECT id, p_option_id, name, status FROM permission_option";
        let params = [];
        
        // Optionally filter by branch_id if provided
        if (branch_id) {
            query += " WHERE branch_id = ?";
            params.push(branch_id);
        }
        
        query += " ORDER BY name ASC";
        
        const [rows] = await pool.query(query, params);
        
        // Parse permissions_assigned JSON for each role
        const rolesWithPermissions = rows.map(role => {
            
            
            return {
                id: role.id,
                name: role.name,
                p_option_id: role.p_option_id,
                status: role.status
            };
        });
        
        res.status(200).json({
            success: true,
            message: 'Permission options retrieved successfully',
            data: rolesWithPermissions,
            total: rolesWithPermissions.length
        });
    } catch (error) {
        console.error('Error fetching permission options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve permission roles',
            error: error.message
        });
    }
});


router.post('/create', async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Create permission option'
    // #swagger.description = 'Create a new permission option that can be assigned to roles'
    /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Permission option creation payload',
        required: true,
        schema: {
            type: 'object',
            required: ['name', 'p_option_id'],
            properties: {
                name: {
                    type: 'string',
                    description: 'Name of the permission option',
                    example: 'View Dashboard'
                },
                p_option_id: {
                    type: 'integer',
                    description: 'Permission option ID',
                    example: 1000
                },
                branch_id: {
                    type: 'string',
                    description: 'Branch ID (optional)',
                    example: '565655'
                },
                status: {
                    type: 'string',
                    description: 'Status of the permission option (default: 1)',
                    example: '1'
                }
            }
        },
        examples: {
            'Create Permission Option': {
                value: {
                    name: 'View Dashboard',
                    p_option_id: 1000,
                    branch_id: '565655',
                    status: '1'
                },
                summary: 'Create a new permission option'
            },
            'Create with Minimal Data': {
                value: {
                    name: 'Edit Settings',
                    p_option_id: 1001
                },
                summary: 'Create permission option with required fields only'
            }
        }
    } */
    /* #swagger.responses[200] = {
        description: 'Permission option created successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true
                },
                message: {
                    type: 'string',
                    example: 'Permission option created successfully'
                },
                data: {
                    type: 'object',
                    description: 'Created permission option data'
                }
            }
        }
    } */
    /* #swagger.responses[400] = {
        description: 'Missing required parameters',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: false
                },
                message: {
                    type: 'string',
                    example: 'Missing required parameters (name, p_option_id)'
                }
            }
        }
    } */
    /* #swagger.responses[500] = {
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: false
                },
                message: {
                    type: 'string',
                    example: 'Failed to create permission option'
                },
                error: {
                    type: 'string',
                    example: 'Error message details'
                }
            }
        }
    } */
    try {
        const { name, p_option_id } = req.body;
    } catch (error) {
        console.error('Error creating permission option:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create permission option',
            error: error.message
        });
    }
});
export default router;