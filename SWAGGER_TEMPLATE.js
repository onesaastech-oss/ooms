/**
 * Swagger Documentation Template
 * Copy this template when creating new API endpoints
 */

// ============================================
// TEMPLATE FOR POST/PUT/PATCH (with body)
// ============================================

router.post('/your-endpoint', auth, async (req, res) => {
    // #swagger.tags = ['YourTag']  // Change to appropriate tag: Settings, Authentication, etc.
    // #swagger.summary = 'Brief summary of endpoint'
    // #swagger.description = 'Detailed description of what this endpoint does'
    // #swagger.security = [{ "bearerAuth": [] }]  // Remove this line if no auth needed
    
    /* #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            type: 'object',
            required: ['required_field1', 'required_field2'],  // List required fields
            properties: {
                field1: { type: 'string', example: 'example value' },
                field2: { type: 'integer', example: 123 },
                field3: { type: 'boolean', example: true },
                field4: { type: 'number', example: 99.99 },
                field5: { type: 'array', items: { type: 'string' }, example: ['item1', 'item2'] }
            },
            example: {
                field1: 'example value',
                field2: 123,
                field3: true,
                field4: 99.99,
                field5: ['item1', 'item2']
            }
        }
    } */
    
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Success message' },
                data: { type: 'object' }
            }
        }
    } */
    /* #swagger.responses[400] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Bad request' }
            }
        }
    } */
    
    try {
        const { field1, field2 } = req.body;
        // Your code here
        res.status(200).json({
            success: true,
            message: 'Success',
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error message',
            error: error.message
        });
    }
});

// ============================================
// TEMPLATE FOR GET (with query parameters)
// ============================================

router.get('/your-endpoint', auth, async (req, res) => {
    // #swagger.tags = ['YourTag']
    // #swagger.summary = 'Get something'
    // #swagger.description = 'Description here'
    // #swagger.security = [{ "bearerAuth": [] }]
    
    /* #swagger.parameters['param1'] = {
        in: 'query',
        required: true,
        type: 'string',
        example: 'value1'
    } */
    /* #swagger.parameters['param2'] = {
        in: 'query',
        required: false,
        type: 'integer',
        example: 10
    } */
    
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Data retrieved successfully' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer', example: 1 },
                            name: { type: 'string', example: 'Item Name' }
                        }
                    }
                }
            }
        }
    } */
    
    try {
        const { param1, param2 } = req.query;
        // Your code here
        res.status(200).json({
            success: true,
            message: 'Data retrieved successfully',
            data: []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error message',
            error: error.message
        });
    }
});

// ============================================
// TEMPLATE FOR DELETE
// ============================================

router.delete('/your-endpoint/:id', auth, async (req, res) => {
    // #swagger.tags = ['YourTag']
    // #swagger.summary = 'Delete something'
    // #swagger.description = 'Description here'
    // #swagger.security = [{ "bearerAuth": [] }]
    
    /* #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        type: 'string',
        example: '123'
    } */
    
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Deleted successfully' }
            }
        }
    } */
    
    try {
        const { id } = req.params;
        // Your code here
        res.status(200).json({
            success: true,
            message: 'Deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error message',
            error: error.message
        });
    }
});

