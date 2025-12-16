import express from "express";
const router = express.Router();
import authRoutes from "./auth/auth.routes.js";
import clientRoutes from "./clients/client.routes.js";
import taskRoutes from "./tasks/task.routes.js";
import uploadRoutes from "./uploads/upload.routes.js";

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/tasks", taskRoutes);
router.use("/upload", uploadRoutes);

export default router;
