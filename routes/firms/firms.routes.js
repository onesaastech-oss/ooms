import express from "express";
import pool from "../../db.js";
import { auth } from "../../middleware/auth.js";

const router = express.Router();

// Smart cache - stores search results automatically
const searchCache = new Map();
const MAX_CACHE_SIZE = 1000; // Cache up to 1000 different searches

function getCachedSearch(cacheKey) {
    return searchCache.get(cacheKey) || null;
}

function setCachedSearch(cacheKey, results) {
    // Keep cache size manageable
    if (searchCache.size >= MAX_CACHE_SIZE) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, results);
}

async function searchFirms(query, limit, branchId = null) {
    const searchTerm = query.toLowerCase();
    
    // Create cache key
    const cacheKey = `${searchTerm}:${limit}:${branchId || 'all'}`;
    
    // Check cache first
    const cached = getCachedSearch(cacheKey);
    if (cached) {
        return { results: cached, fromCache: true };
    }
    
    // Search in database with all fields including address
    const exactTerm = query.trim();
    const prefixTerm = `${query.trim()}%`;
    const containsTerm = `%${query.trim()}%`;
    
    let searchQuery = `
        SELECT 
            id, firm_id, firm_name, username, firm_type, branch_id,
            address_line_1, address_line_2, city, state, country, pincode,
            gst_no, pan_no
        FROM firms 
        WHERE is_deleted = '0' AND status = '1'
    `;
    
    const queryParams = [];
    
    // Add branch filter if provided
    if (branchId) {
        searchQuery += ` AND branch_id = ?`;
        queryParams.push(branchId);
    }
    
    // Search in all fields including address
    searchQuery += `
        AND (
            firm_name = ? OR
            firm_name LIKE ? OR 
            firm_name LIKE ? OR
            firm_id LIKE ? OR 
            username LIKE ? OR
            address_line_1 LIKE ? OR
            address_line_2 LIKE ? OR
            city LIKE ? OR
            state LIKE ? OR
            country LIKE ? OR
            pincode LIKE ? OR
            gst_no LIKE ? OR
            pan_no LIKE ?
        )
        ORDER BY 
            CASE 
                WHEN firm_name = ? THEN 1
                WHEN firm_name LIKE ? THEN 2
                WHEN firm_id = ? THEN 3
                WHEN username = ? THEN 4
                WHEN city = ? THEN 5
                WHEN state = ? THEN 6
                ELSE 7
            END,
            LENGTH(firm_name) ASC
        LIMIT ?
    `;
    
    // Add all search parameters
    queryParams.push(
        // Search conditions
        exactTerm, prefixTerm, containsTerm, prefixTerm, prefixTerm,
        containsTerm, containsTerm, containsTerm, containsTerm, containsTerm, containsTerm, containsTerm, containsTerm,
        // Ordering conditions  
        exactTerm, prefixTerm, exactTerm, exactTerm, exactTerm, exactTerm,
        // Limit
        limit
    );
    
    const [dbResults] = await pool.query(searchQuery, queryParams);
    
    // Format results
    const results = dbResults.map(firm => ({
        id: firm.id,
        firm_id: firm.firm_id,
        name: firm.firm_name,
        username: firm.username,
        type: firm.firm_type,
        branch_id: firm.branch_id,
        address: `${firm.address_line_1 || ''} ${firm.address_line_2 || ''}`.trim(),
        city: firm.city || '',
        state: firm.state || '',
        country: firm.country || '',
        pincode: firm.pincode || '',
        location: [firm.city, firm.state, firm.country].filter(Boolean).join(', '),
        gst_no: firm.gst_no || '',
        pan_no: firm.pan_no || '',
        display: `${firm.firm_name} (${firm.firm_id})`,
        subtitle: firm.username ? `@${firm.username}` : firm.firm_type
    }));
    
    // Cache the results automatically
    setCachedSearch(cacheKey, results);
    
    return { results, fromCache: false };
}

/**
 * GET /firms/search?q=searchterm
 * Single optimized search endpoint for B2B platform with 2K firms
 * Features: 1-hour caching, smart ordering, multi-field search
 */
router.get("/search", auth, async (req, res) => {
    // #swagger.tags = ['Firms']
    // #swagger.summary = 'Search firms (optimized for B2B with 2K firms)'
    // #swagger.description = 'Single endpoint for firm search with 1-hour caching and smart relevance ordering'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['q'] = {
        in: 'query',
        description: 'Search query string',
        required: true,
        type: 'string'
    } */
    /* #swagger.parameters['limit'] = {
        in: 'query',
        description: 'Maximum number of results (default: 10, max: 50)',
        required: false,
        type: 'integer'
    } */
    /* #swagger.parameters['branch_id'] = {
        in: 'query',
        description: 'Filter by branch ID',
        required: false,
        type: 'string'
    } */
    
    try {
        const startTime = Date.now();
        
        const { q: query, limit = 10, branch_id } = req.query;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query (q) is required'
            });
        }

        const searchTerm = query.trim();
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

        // Smart search: cache first, then database, then auto-cache
        const searchStart = Date.now();
        const { results, fromCache } = await searchFirms(searchTerm, limitNum, branch_id);
        const searchTime = Date.now() - searchStart;

        const totalTime = Date.now() - startTime;

        const response = {
            success: true,
            query: searchTerm,
            suggestions: results,
            count: results.length,
            // Performance metrics
            _performance: {
                total_time_ms: totalTime,
                search_time_ms: searchTime,
                search_method: fromCache ? 'cache_hit' : 'database_then_cache',
                cache_size: searchCache.size,
                searched_fields: ['name', 'firm_id', 'username', 'type', 'address', 'city', 'state', 'pincode', 'gst_no', 'pan_no']
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error in firm search:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /firms/types
 * Get all unique firm types for filter dropdown
 */
router.get("/types", auth, async (req, res) => {
    // #swagger.tags = ['Firms']
    // #swagger.summary = 'Get all firm types'
    // #swagger.description = 'Returns unique firm types for filter dropdown'
    // #swagger.security = [{ "bearerAuth": [] }]
    
    try {
        // Cache key for firm types (rarely changes)
        const cacheKey = 'firm_types';
        const cachedResult = getCachedResult(cacheKey);
        
        if (cachedResult) {
            return res.json(cachedResult);
        }

        const [rows] = await pool.query(`
            SELECT DISTINCT firm_type 
            FROM firms 
            WHERE is_deleted = '0' AND firm_type IS NOT NULL AND firm_type != ''
            ORDER BY firm_type ASC
        `);

        const response = {
            success: true,
            data: rows.map(row => row.firm_type)
        };

        // Cache firm types for longer (they rarely change)
        setCachedResult(cacheKey, response);

        res.json(response);

    } catch (error) {
        console.error('Error fetching firm types:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch firm types',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /firms/:id
 * Get single firm details by ID
 */
router.get("/:id", auth, async (req, res) => {
    // #swagger.tags = ['Firms']
    // #swagger.summary = 'Get firm by ID'
    // #swagger.description = 'Returns detailed information for a specific firm'
    // #swagger.security = [{ "bearerAuth": [] }]
    
    try {
        const firmId = parseInt(req.params.id);
        
        if (!firmId || firmId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid firm ID'
            });
        }

        // Cache individual firm details
        const cacheKey = `firm_detail:${firmId}`;
        const cachedResult = getCachedResult(cacheKey);
        
        if (cachedResult) {
            return res.json(cachedResult);
        }

        const [rows] = await pool.query(`
            SELECT * FROM firms 
            WHERE id = ? AND is_deleted = '0'
        `, [firmId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Firm not found'
            });
        }

        const response = {
            success: true,
            data: rows[0]
        };

        // Cache firm details for 1 hour
        setCachedResult(cacheKey, response);

        res.json(response);

    } catch (error) {
        console.error('Error fetching firm:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch firm',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;