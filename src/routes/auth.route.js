import express from "express";
const router = express.Router();
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  login,
  logout,
  signup,
  updateProfile,
  userAuth,
  updatePassword,
  sendResetMail,
  verifyMailTokenAndChangePass,
  validateUserName,
  updatePrivacy,
} from "../controllers/auth.controller.js";

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, userAuth);

router.patch("/update-password", protectRoute, updatePassword);

router.post("/forgot-password/mail", sendResetMail);

router.post("/forgot-password/verify", verifyMailTokenAndChangePass);

router.get("/validateUserName/:username", validateUserName);

router.put("/updatePrivacy", protectRoute, updatePrivacy);

export default router;
