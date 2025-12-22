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
        required: false,
        type: 'string',
        example: '565655'
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Permission roles retrieved successfully' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', example: 'Manager' },
                            permissions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        p_option_id: { type: 'integer', example: 1000 },
                                        key: { type: 'string', example: 'create task' }
                                    }
                                },
                                example: [
                                    { p_option_id: 1000, key: 'create task' },
                                    { p_option_id: 1002, key: 'complete task' }
                                ]
                            }
                        }
                    }
                },
                total: { type: 'integer', example: 2 }
            }
        }
    } */
    /* #swagger.responses[500] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to retrieve permission roles' }
            }
        }
    } */
    try {
        const { branch_id } = req.query;
        
        let query = "SELECT name, permissions_assigned FROM permission_role";
        let params = [];
        
        // Optionally filter by branch_id if provided
        if (branch_id) {
            query += " WHERE branch_id = ?";
            params.push(branch_id);
        }
        
        query += " ORDER BY name ASC";
        
        const [rows] = await pool.query(query, params);
        
        // Parse permissions_assigned JSON for each role and return simplified response
        const rolesWithPermissions = rows.map(role => {
            let permissionsArray = [];
            
            // Try to parse the permissions_assigned JSON string
            if (role.permissions_assigned) {
                try {
                    const parsed = typeof role.permissions_assigned === 'string' 
                        ? JSON.parse(role.permissions_assigned) 
                        : role.permissions_assigned;
                    
                    // Extract permissions array from the parsed object
                    if (parsed && parsed.permissions && Array.isArray(parsed.permissions)) {
                        permissionsArray = parsed.permissions;
                    } else if (Array.isArray(parsed)) {
                        permissionsArray = parsed;
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse permissions for role ${role.name}:`, parseError);
                    permissionsArray = [];
                }
            }
            
            return {
                name: role.name,
                permissions: permissionsArray
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
        required: false,
        type: 'string',
        example: '565655'
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Permission options retrieved successfully' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer', example: 1 },
                            p_option_id: { type: 'integer', example: 1000 },
                            name: { type: 'string', example: 'View Dashboard' }
                        }
                    }
                },
                total: { type: 'integer', example: 10 }
            }
        }
    } */
    /* #swagger.responses[500] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to retrieve permission roles' }
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
        required: true,
        schema: {
            type: 'object',
            required: ['name', 'p_option_id'],
            properties: {
                name: { type: 'string', example: 'View Dashboard' },
                p_option_id: { type: 'integer', example: 1000 },
                branch_id: { type: 'string', example: '565655' }
            },
            example: {
                name: 'View Dashboard',
                p_option_id: 1000,
                branch_id: '565655'
            }
        }
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Permission option created successfully' }
            }
        }
    } */
    /* #swagger.responses[400] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Missing required parameters' }
            }
        }
    } */
    /* #swagger.responses[500] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to create permission option' }
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