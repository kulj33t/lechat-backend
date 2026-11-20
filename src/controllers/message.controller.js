import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId } from "../lib/socket.js";
import { io } from "../lib/socket.js";
import mongoose from "mongoose";
import UserRequest from "../models/user.request.model.js";

export const getAllMessages = async (req, res) => {
  try {
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [{ senderId: myId }, { receiverId: myId }],
    });
    if (!messages || messages.length === 0) {
      return res.status(404).json({
        status: "blank",
        message: "No messages found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    console.log("Error in getMessages controller", error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server error",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    if (!mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid receiver id",
      });
    }
    if (req.user._id.equals(receiverId)) {
      return res.status(400).json({
        status: "error",
        message: "Sender and reciever id cannot be same",
      });
    }
    const receiver = await User.findById(receiverId).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );
    if (!receiver) {
      return res.status(400).json({
        status: "error",
        message: "Receiver id is invalid",
      });
    }
    if (!(typeof text === "string" && text.trim()) && !image) {
      return res.status(400).json({
        status: "error",
        message: "A message or image is required",
      });
    }
    const isConnection = await UserRequest.exists({
      status: "accepted",
      $or: [
        { senderId: req.user._id, receiverId },
        { senderId: receiverId, receiverId: req.user._id },
      ],
    });
    if (!isConnection) {
      return res.status(403).json({
        status: "error",
        message: "You can only message a connection",
      });
    }
    const senderId = req.user._id;
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: "BaatCheet/ChatPhotos",
      });
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    return res.status(200).json({
      status: "success",
      message: "Message saved successfully",
      data: newMessage,
    });
  } catch (error) {
    console.log("Error in sendMessage", error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server error",
    });
  }
};

export const updateUnreadCount = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!mongoose.isValidObjectId(userId) || req.user._id.equals(userId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid conversation user",
      });
    }
    const isConnection = await UserRequest.exists({
      status: "accepted",
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id },
      ],
    });
    if (!isConnection) {
      return res.status(403).json({
        status: "error",
        message: "Conversation is not available",
      });
    }

    await Message.updateMany(
      { senderId: userId, receiverId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    const receiverSocketId = getReceiverSocketId(userId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateRead", { userId: req.user._id });
    }

    res.status(200).send({ success: true });
  } catch (error) {
    res.status(500).send({ success: false, message: "Internal server error" });
  }
};
