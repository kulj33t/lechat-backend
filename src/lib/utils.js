import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

export const generateMailToken = async () => {
  return randomBytes(20).toString("hex");
};

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_KEY, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "None",
    secure: true,
  });
  return token;
};
