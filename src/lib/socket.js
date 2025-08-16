import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import GroupChat from "../models/group.message.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173","https://lechat-public.vercel.app"],
    credentials: true,
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
  socket.on("updateLastMessageIsRead", async ({ messageId, userId }) => {
    const receiverSocketId = getReceiverSocketId(userId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateRead");
    }

    try {
      await Message.findByIdAndUpdate(messageId, { $set: { isRead: true } });
    } catch (err) {
      console.error("Failed to update messages in DB:", err);
    }
  });

  socket.on("updateLastGroupMessageIsRead", async ({ messageId, userId }) => {
    try {
      await GroupChat.findByIdAndUpdate(messageId, {
        $addToSet: { isRead: userId },
      });
    } catch (err) {
      console.error("Failed to update messages in DB:", err);
    }
  });
});

export { io, app, server };
