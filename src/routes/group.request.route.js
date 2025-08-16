import express from "express"
import { protectRoute } from "../middleware/auth.middleware.js";
import { getGroupRequestsForAdmin, getGroupRequestsForUser, reviewInviteByAdmin, reviewInviteByUser, sendInviteByAdmin, sendInviteByUser } from "../controllers/group.request.controller.js";

const router = express.Router();

router.post("/send/admin",protectRoute,sendInviteByAdmin);

router.post("/send/user",protectRoute,sendInviteByUser)

router.get("/getRequests/user",protectRoute,getGroupRequestsForUser);

router.get("/getRequests/admin/:groupId",protectRoute,getGroupRequestsForAdmin);

router.post("/review/user/:status",protectRoute,reviewInviteByUser);

router.post("/review/admin/:status",protectRoute,reviewInviteByAdmin);


export default router