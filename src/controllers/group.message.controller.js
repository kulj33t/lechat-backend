import mongoose from "mongoose";
import Group from "../models/group.asign.model.js";
import cloudinary from "../lib/cloudinary.js";
import GroupChat from "../models/group.message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const sendMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text, image } = req.body;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group does not exists",
      });
    }
    if (!group.members.includes(req.user._id)) {
      return res.status(400).json({
        status: "error",
        message: "Cannot send messages in group without joining it",
      });
    }
    const senderId = req.user._id;
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: "BaatCheet/Group/Chat",
      });
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = new GroupChat({
      senderId,
      groupId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const data = await newMessage.populate("senderId", "fullName profilePic");

    const groupMembers = group.members;

    groupMembers.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId._id.toString());
      if (socketId) {
        io.to(socketId).emit("newGroupMessage", data);
      }
    });
    return res.status(200).json({
      status: "success",
      message: "Message saved successfully",
      data,
    });
  } catch (error) {
    console.log("Error in sendMessage", error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server error",
    });
  }
};

export const getAllMessages = async (req, res) => {
  try {
    const groupIds = req.user.groups.map((g) => g._id);

    const messages = await GroupChat.find({
      groupId: { $in: groupIds },
    }).populate("senderId", "fullName profilePic");

    if (!messages) {
      return res.status(404).json({
        status: "error",
        message: "No Messages in group yet",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Group messages fethced successfully",
      data: messages,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updateGroupReadCount = async (req, res) => {
  const { groupId } = req.body;

  try {
    const groupMessages = await GroupChat.find({
      groupId,
      senderId: { $ne: req.user._id },
      isRead: { $nin: [req.user._id] },
    });

    for (const message of groupMessages) {
      message.isRead.push(req.user._id);
      await message.save();
    }

    res.status(200).send({ success: true });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};
