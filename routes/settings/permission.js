import express from 'express';
const router = express.Router();

import pool from "../../db.js";
// import { auth } from "../../middleware/auth.js";
// import { RANDOM_STRING, UNIX_TIMESTAMP } from "../../helpers/function.js";





router.get('/list', async (req, res) => {
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