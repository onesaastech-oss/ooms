# Swagger Documentation Guide

## How to Add Swagger Documentation with Payload Examples for New APIs

### Step 1: Create Your Route in a `.routes.js` File

Make sure your route file ends with `.routes.js` (e.g., `myfeature.routes.js`) so the Swagger generator can find it.

### Step 2: Add Swagger Comments

Add Swagger comments directly above your route handler. Here's the template:

#### For POST/PUT/PATCH Endpoints (with body):

```javascript
router.post('/your-endpoint', auth, async (req, res) => {
    // #swagger.tags = ['YourTag']
    // #swagger.summary = 'Brief summary of what this endpoint does'
    // #swagger.description = 'Detailed description of the endpoint'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            type: 'object',
            required: ['field1', 'field2'],
            properties: {
                field1: { type: 'string', example: 'example value' },
                field2: { type: 'integer', example: 123 },
                field3: { type: 'boolean', example: true }
            },
            example: {
                field1: 'example value',
                field2: 123,
                field3: true
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
    
    // Your route handler code here
    try {
        // ...
    } catch (error) {
        // ...
    }
});
```

#### For GET Endpoints (with query parameters):

```javascript
router.get('/your-endpoint', auth, async (req, res) => {
    // #swagger.tags = ['YourTag']
    // #swagger.summary = 'Get something'
    // #swagger.description = 'Description here'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['param_name'] = {
        in: 'query',
        required: true,
        type: 'string',
        example: 'example-value'
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'array', items: { type: 'object' } }
            }
        }
    } */
    
    // Your route handler code
});
```

### Step 3: Add to routeConfigs (Alternative/Backup Method)

If the inline comments don't work, you can also add the route configuration to `api-docs/swagger/pathGenerators.js`:

```javascript
// In pathGenerators.js, add to routeConfigs object:
'/your-endpoint': {
    post: {
        summary: 'Your endpoint summary',
        description: 'Your endpoint description',
        useEncryption: false,
        bodySchema: {
            type: 'object',
            required: ['field1'],
            properties: {
                field1: { type: 'string', example: 'value' },
                field2: { type: 'integer', example: 123 }
            },
            example: {
                field1: 'value',
                field2: 123
            }
        }
    }
}
```

### Step 4: Mount Your Route

Make sure your route is mounted in `routes/index.js`:

```javascript
import yourRoutes from "./yourfolder/yourfeature.routes.js";
router.use("/your-path", yourRoutes);
```

### Step 5: Generate Swagger Documentation

Run the Swagger generator:

```bash
npm run swagger
```

Or in watch mode (auto-regenerates on file changes):

```bash
npm run swagger:watch
```

### Important Notes:

1. **File Naming**: Route files must end with `.routes.js` to be discovered
2. **Mount Path**: The generator automatically includes mount paths (e.g., `/settings/staff` + `/create` = `/api/v1/settings/staff/create`)
3. **Example Format**: The `example` object in the schema should use JavaScript object literal syntax (single quotes, no quotes on keys)
4. **Tags**: Use appropriate tags like `['Settings']`, `['Authentication']`, etc. (see `api-docs/swagger/tags.js`)

### Example: Complete Route with Swagger

```javascript
import express from 'express';
const router = express.Router();
import { auth } from "../../middleware/auth.js";

router.post('/create-item', auth, async (req, res) => {
    // #swagger.tags = ['Items']
    // #swagger.summary = 'Create a new item'
    // #swagger.description = 'Creates a new item with the provided details'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            type: 'object',
            required: ['name', 'price'],
            properties: {
                name: { type: 'string', example: 'Product Name' },
                price: { type: 'number', example: 99.99 },
                description: { type: 'string', example: 'Product description' },
                category: { type: 'string', example: 'electronics' }
            },
            example: {
                name: 'Product Name',
                price: 99.99,
                description: 'Product description',
                category: 'electronics'
            }
        }
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Item created successfully' },
                data: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Product Name' }
                    }
                }
            }
        }
    } */
    
    try {
        const { name, price, description, category } = req.body;
        // Your logic here
        res.status(200).json({
            success: true,
            message: 'Item created successfully',
            data: { id: 1, name }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create item',
            error: error.message
        });
    }
});

export default router;
```

### Viewing Your Documentation

After generating, view your Swagger documentation at:
- **URL**: `http://localhost:8877/api-docs`
- The payload examples will appear in the "Example Value" section when you expand the endpoint

### Troubleshooting

If examples don't show up:
1. Check that your file ends with `.routes.js`
2. Verify the route is mounted in `routes/index.js`
3. Run `npm run swagger` to regenerate
4. Check browser console for errors
5. As a backup, add the route to `routeConfigs` in `pathGenerators.js`

