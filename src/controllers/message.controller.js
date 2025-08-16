import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId } from "../lib/socket.js";
import { io } from "../lib/socket.js";
import mongoose from "mongoose";

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

    const receiverSocketId = getReceiverSocketId(userId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateRead");
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: req.user._id },
        { senderId: req.user._id, receiverId: userId },
      ],
    });

    const messageIdsToUpdate = messages
      .filter(
        (message) => message.senderId.toString() !== req.user._id.toString()
      )
      .map((message) => message._id);

    if (messageIdsToUpdate.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIdsToUpdate } },
        { $set: { isRead: true } }
      );
    }

    res.status(200).send({ success: true });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};
