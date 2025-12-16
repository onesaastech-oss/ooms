import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import http from "http";
import { setupSocketIO } from "./helpers/Socket.js";
import { PORT } from "./Env.js";

const app = express();
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());
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