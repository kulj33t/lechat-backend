import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getAllMessages,
  sendMessage,
  updateGroupReadCount,
} from "../controllers/group.message.controller.js";

const router = express.Router();

router.post("/send/:groupId", protectRoute, sendMessage);

router.get("/getAllMessages", protectRoute, getAllMessages);

router.put("/updateGroupUnread",protectRoute,updateGroupReadCount)

export default router;
