import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import path from "path";
import fs from "fs";
import mime from "mime";
import { fileURLToPath } from "url";
import http from "http";
import { setupSocketIO } from "./helpers/Socket.js";
import { PORT } from "./Env.js";

const app = express();
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());
app.use("/auth", authRouter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/upload/:filename", (req, res) => {
    const filePath = path.join(path.join(__dirname, "/media/upload/temp"), req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    const type = mime.getType(filePath);

    if (type && type.startsWith("video")) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunkSize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": type
            });

            file.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": type
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } else {
        res.setHeader("Content-Type", type || "application/octet-stream");
        res.setHeader("Content-Disposition", "inline");
        fs.createReadStream(filePath).pipe(res);
    }
});

app.get("/error/:filename", (req, res) => {
    const filePath = path.join(path.join(__dirname, "/media/error"), req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    const type = mime.getType(filePath);

    if (type && type.startsWith("video")) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunkSize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": type
            });

            file.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": type
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } else {
        res.setHeader("Content-Type", type || "application/octet-stream");
        res.setHeader("Content-Disposition", "inline");
        fs.createReadStream(filePath).pipe(res);
    }
});

app.use("/chat-media", express.static(path.join(process.cwd(), "/media/chat")));


const server = http.createServer(app);
const WsIo = setupSocketIO(server);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        connections: WsIo.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});


server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

export { WsIo };