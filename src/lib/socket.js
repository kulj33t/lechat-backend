import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import GroupChat from "../models/group.message.model.js";
import Group from "../models/group.asign.model.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { socketCorsOptions } from "./cors.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: socketCorsOptions,
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

const userSocketMap = {};
const userSocketIds = {};

const getSessionToken = (cookieHeader = "") => {
  const jwtCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("jwt="));
  return jwtCookie ? decodeURIComponent(jwtCookie.slice(4)) : null;
};

io.use(async (socket, next) => {
  try {
    const socketToken = socket.handshake.auth?.token;
    const token = socketToken || getSessionToken(socket.handshake.headers.cookie);
    if (!token || !process.env.JWT_KEY) {
      return next(new Error("unauthorized"));
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_KEY,
      socketToken ? { audience: "lechat-socket" } : undefined
    );
    if (socketToken && decoded.scope !== "socket") {
      return next(new Error("unauthorized"));
    }
    const user = await User.findById(decoded.userId).select("_id");
    if (!user) return next(new Error("unauthorized"));
    socket.data.userId = user._id.toString();
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  const userId = socket.data.userId;
  userSocketIds[userId] ||= new Set();
  userSocketIds[userId].add(socket.id);
  userSocketMap[userId] = socket.id;

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    userSocketIds[userId]?.delete(socket.id);
    if (userSocketMap[userId] === socket.id) {
      const otherSocketIds = [...(userSocketIds[userId] || [])];
      if (otherSocketIds.length > 0) {
        userSocketMap[userId] = otherSocketIds[otherSocketIds.length - 1];
      } else {
        delete userSocketMap[userId];
        delete userSocketIds[userId];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
  socket.on("updateLastMessageIsRead", async ({ messageId } = {}) => {
    try {
      if (!mongoose.isValidObjectId(messageId)) return;
      const message = await Message.findById(messageId);
      if (!message || message.receiverId.toString() !== userId) return;
      if (!message.isRead) {
        message.isRead = true;
        await message.save();
      }
      const senderSocketId = getReceiverSocketId(message.senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("updateRead", { userId });
      }
    } catch (error) {
      console.error("Failed to update a direct message read state:", error);
    }
  });

  socket.on("updateLastGroupMessageIsRead", async ({ messageId } = {}) => {
    try {
      if (!mongoose.isValidObjectId(messageId)) return;
      const message = await GroupChat.findById(messageId).select(
        "senderId groupId"
      );
      if (!message || message.senderId.toString() === userId) return;
      const isMember = await Group.exists({
        _id: message.groupId,
        members: userId,
      });
      if (!isMember) return;
      await GroupChat.updateOne(
        { _id: messageId },
        { $addToSet: { isRead: userId } }
      );
    } catch (error) {
      console.error("Failed to update a group message read state:", error);
    }
  });
});

export { io, app, server };
