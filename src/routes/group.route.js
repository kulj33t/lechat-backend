import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  addMember,
  createGroup,
  deleteGroup,
  exitGroup,
  getConnectionsToAddGroup,
  getGroups,
  getNewGroups,
  joinGroup,
  removeMember,
  updateDp,
  updateGroup,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protectRoute, createGroup);

router.post("/addMember", protectRoute, addMember);

router.post("/removeMember", protectRoute, removeMember);

router.get("/findMyGroups", protectRoute, getGroups);

router.post("/exitGroup", protectRoute, exitGroup);

router.delete("/deleteGroup", protectRoute, deleteGroup);

router.post("/joinGroup", protectRoute, joinGroup);

router.patch("/updateGroup/:groupId", protectRoute, updateGroup);

router.put("/updateGroupPhoto/:groupId", protectRoute, updateDp);

router.get("/exploreGroups", protectRoute, getNewGroups);

router.get("/connectionForGroup/:groupId",protectRoute,getConnectionsToAddGroup);

export default router;
