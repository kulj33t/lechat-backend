import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res
        .status(401)
        .json({ status: "error", message: "Unauthorized - No token provided" });
    }
    const decodedId = jwt.verify(token, process.env.JWT_KEY);
    if (!decodedId) {
      return res
        .status(401)
        .json({ status: "error", message: "Unauthorized - Invalid token" });
    }

    const user = await User.findById(decodedId.userId).select(
      "-resetPasswordToken -resetPasswordExpires"
    ).populate("groups","name photo");
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};
