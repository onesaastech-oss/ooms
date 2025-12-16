import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import apiRoutes from "./routes/index.js";
import { swaggerOptions } from "./api-docs/swagger/config.js";
import http from "http";
import { setupSocketIO } from "./helpers/Socket.js";
import { PORT } from "./Env.js";

const app = express();
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());

// Auto-generate Swagger documentation in development
if (process.env.NODE_ENV !== 'production') {
    try {
        const { generateSwaggerDoc } = await import('./api-docs/swagger/index.js');
        const result = await generateSwaggerDoc({ verbose: false });
        if (result.success) {
            console.log('📚 Swagger documentation auto-generated');
        } else {
            console.log('⚠️  Could not auto-generate Swagger docs:', result.error);
        }
    } catch (error) {
        console.log('⚠️  Could not auto-generate Swagger docs:', error.message);
    }
}

// Swagger Documentation
let swaggerDocument;
try {
    const swaggerFile = fs.readFileSync('./swagger-output.json', 'utf8');
    swaggerDocument = JSON.parse(swaggerFile);
} catch (error) {
    console.log('Swagger documentation not found. Run "npm run swagger" to generate it.');
    swaggerDocument = {
        info: { title: 'OOMS API', version: '1.0.0' },
        paths: {}
    };
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));


// all api end point and entry point
app.use("/api/v1", apiRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString()
    });
});

const server = http.createServer(app);
const WsIo = setupSocketIO(server);


server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

export { WsIo };