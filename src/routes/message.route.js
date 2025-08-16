import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  sendMessage,
  getAllMessages,
  updateUnreadCount,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/getAllMessages", protectRoute, getAllMessages);

router.post("/send/:id", protectRoute, sendMessage);

router.put("/updateRead",protectRoute,updateUnreadCount)

export default router;
