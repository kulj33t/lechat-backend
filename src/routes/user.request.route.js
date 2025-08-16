import express from "express"
import { exploreUsers, getConnections, getRequests, removeConnection, reviewRequest, searchUser, sendRequest } from "../controllers/user.request.controller.js";
import {protectRoute} from "../middleware/auth.middleware.js"

const router = express.Router();

router.post("/send",protectRoute,sendRequest);

router.get("/fetch",protectRoute,getRequests);

router.post("/review/:status",protectRoute,reviewRequest);

router.post("/remove",protectRoute,removeConnection);

router.get("/exploreUsers",protectRoute,exploreUsers);

router.get("/connections",protectRoute,getConnections);

router.get("/search/:username",protectRoute,searchUser);


export default router