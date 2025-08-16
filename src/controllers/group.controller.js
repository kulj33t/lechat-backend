import cloudinary from "../lib/cloudinary.js";
import Group from "../models/group.asign.model.js";
import GroupChat from "../models/group.message.model.js";
import User from "../models/user.model.js";
import GroupRequest from "../models/group.request.model.js";
import mongoose from "mongoose";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const admin = req.user;
    const members = req.user._id;
    const user = await User.findById(admin._id);
    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "User should be registered to create a group",
      });
    }

    const newGroup = new Group({
      name,
      members,
      admin: members,
    });

    admin.groups = admin.groups
      ? [...admin.groups, newGroup._id]
      : [newGroup._id];
    await admin.save();
    await newGroup.save();
    const data = await newGroup.populate("members", "fullName profilePic");

    return res.status(201).json({
      status: "success",
      message: "Group created successfully",
      data,
    });
  } catch (error) {
    console.log("Error in creating group ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const addMember = async (req, res) => {
  try {
    const { userId: memberToAdd, groupId } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId).populate(
      "members",
      "fullName profilePic"
    );
    if (!group) {
      return res
        .status(404)
        .json({ status: "error", message: "Group not found" });
    }

    if (
      group.admin.toString() !== req.user._id.toString() &&
      group.visibility === "private"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Only admins can add members to private groups",
      });
    }

    if (memberToAdd.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ status: "error", message: "Cannot add yourself to the group" });
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === memberToAdd.toString()
    );

    if (isMember) {
      return res.status(400).json({
        status: "error",
        message: "Already a member fo group ",
      });
    }

    const user = await User.findById(memberToAdd).select(
      "fullName profilePic privacy groups"
    );
    console.log(user);
    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: `User not found: ${memberToAdd}` });
    }
    if (user.privacy) {
      return res.status(400).json({
        status: "error",
        message: `Cannot add private user`,
      });
    }

    user.groups = user.groups ? [...user.groups, groupId] : [groupId];
    await user.save();

    group.members.push(memberToAdd);
    await group.save();

    await group.populate("members", "fullName profilePic");

    const recieverSocketId = getReceiverSocketId(user._id);
    if (recieverSocketId) {
      io.to(recieverSocketId).emit("newGroup", group);
    }

    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("newMember", { groupId, user });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Users added successfully",
      data: group,
    });
  } catch (error) {
    console.error("Error adding members ->", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const getGroups = async (req, res) => {
  try {
    const groupIds = req.user.groups;

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No groups found",
      });
    }

    const groups = await Group.find({
      _id: { $in: groupIds },
    }).populate("members", "fullName profilePic");

    return res.status(200).json({
      status: "success",
      message: "Groups fetched successfully",
      data: groups,
    });
  } catch (error) {
    console.log("Error in finding groups ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { userId: memberToRemove, groupId } = req.body;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }
    if (memberToRemove.toString() === req.user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message:
          "Cannot remove yourself from the group,instead you can delete the group",
      });
    }
    const user = await User.findById(memberToRemove);
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group does not exist or wrong groupId",
      });
    }
    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "User not found to remove from group",
      });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "only Admins can remove the members",
      });
    }
    if (user.groups.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "User is not joined in  group",
      });
    }
    if (!group.members.includes(memberToRemove)) {
      return res.status(400).json({
        status: "error",
        message: "User is not in the group, can't remove",
      });
    }

    user.groups = user.groups.filter(
      (group) => group._id.toString() !== groupId.toString()
    );
    group.members = group.members.filter(
      (id) => id.toString() !== memberToRemove.toString()
    );

    await GroupRequest.findOneAndDelete({
      $or: [{ senderId: user._id }, { receiverId: user._id }],
      groupId,
    });

    await user.save();
    await group.save();
    const recieverSocketId = getReceiverSocketId(user._id);
    if (recieverSocketId) {
      io.to(recieverSocketId).emit("removedGroup", groupId);
    }

    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("updatedMembers", {
          groupId,
          userId:memberToRemove,
        });
      }
    }
    const data = await group.populate("members", "fullName profilePic");
    return res.status(200).json({
      status: "success",
      message: "Member successfully removed from group",
      data,
    });
  } catch (error) {
    console.log("Error while removing the member ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const exitGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId).populate(
      "members",
      "_id groups"
    );
    if (!group) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }

    const user = req.user;

    const isMember = group.members.some(
      (member) => member._id.toString() === user._id.toString()
    );
    if (!user.groups.includes(groupId) && !isMember) {
      return res.status(400).json({
        status: "error",
        message: "You must be part of the group to leave it",
      });
    }

    if (group.admin.toString() === user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "Admins cannot leave the group. They must delete it.",
      });
    }

    await GroupRequest.findOneAndDelete({
      groupId,
      $or: [{ senderId: user._id }, { receiverId: user._id }],
    });

    group.members = group.members.filter(
      (member) => member._id.toString() !== user._id.toString()
    );
    user.groups = user.groups.filter(
      (group) => group._id.toString() !== groupId
    );

    await group.save();
    await user.save();

    const groupIds = user.groups;
    const newGroups = await Group.find({
      _id: { $in: groupIds },
    }).populate("members", "fullName profilePic");

    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("updatedMembers", {
          groupId,
          userId: user._id,
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Group exited successfully",
      data: newGroups,
    });
  } catch (error) {
    console.log("Error while exiting the group ->", error.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const { groupId } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group ID",
      });
    }

    const user = req.user;
    if (user.groups.includes(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Already joined the group",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group not found",
      });
    }

    if (group.members.includes(user._id)) {
      return res.status(400).json({
        status: "error",
        message: "Already joined the group",
      });
    }

    if (group.visibility === "private") {
      return res.status(400).json({
        status: "error",
        message: "Group is private, cannot join without invite",
      });
    }

    group.members.push(user._id);
    user.groups.push(groupId);

    await group.save();
    await user.save();

    const userData = {fullName:user.fullName,profilePic:user.profilePic,_id:user._id}
    const updatedUser = await user.populate({
      path: "groups",
      select: "name members photo",
      populate: {
        path: "members",
        select: "fullName profilePic",
      },
    });
    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("newMember", { groupId, user:userData });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Group joined successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.log("Error in joining group ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(groupId).populate(
      "members",
      "_id groups"
    );

    if (!group) {
      return res.status(404).json({
        status: "error",
        message: "Group not found to delete",
      });
    }

    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "Only the admin can delete the group",
      });
    }

    for (const member of group.members) {
      member.groups = member.groups.filter(
        (group) => group.toString() !== groupId
      );
      await member.save();
    }

    await GroupChat.deleteMany({ groupId });
    const groupMembers = group.members;
    await Group.findByIdAndDelete(groupId);
    for (const member of groupMembers) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("removedGroup", groupId);
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.log("Error while deleting the group ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { newName, description, visibility } = req.body;
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }
    const group = await Group.findById(groupId).populate(
      "members",
      "fullName profilePic"
    );
    if (!group) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "Only admin can edit the group info",
      });
    }
    if (visibility) {
      if (visibility === "private" || visibility === "public") {
        group.visibility = visibility;
      }
    }
    if (newName) {
      group.name = newName;
    }
    if (description) {
      group.description = description;
    }

    if (!newName && !description && !visibility) {
      return res.status(400).json({
        status: "error",
        message: "At least on feild is required",
      });
    }
    await group.save();
    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("updatedGroupData", { groupId, group });
      }
    }
    return res.status(200).json({
      status: "success",
      message: "Group info updated successfully",
      data: group,
    });
  } catch (error) {
    console.log("Error in updating group ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updateDp = async (req, res) => {
  try {
    const { newPhoto } = req.body;
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }
    const group = await Group.findById(groupId).populate(
      "members",
      "fullName profilePic"
    );
    if (!group) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "Only admin can edit the group info",
      });
    }
    if (!newPhoto) {
      return res.status(400).json({
        status: "error",
        message: "Image is required",
      });
    }
    let imageUrl;
    if (newPhoto) {
      const uploadResponse = await cloudinary.uploader.upload(newPhoto, {
        folder: "BaatCheet/Group/Dp",
      });
      imageUrl = uploadResponse.secure_url;
      group.photo = imageUrl;
    }
    await group.save();
    for (const member of group.members) {
      const memberSocketId = getReceiverSocketId(member._id);
      if (memberSocketId) {
        io.to(memberSocketId).emit("updatedGroupData", { groupId, group });
      }
    }
    return res.status(200).json({
      status: "success",
      message: "Image updated successfully",
      data: group,
    });
  } catch (error) {
    console.log("Error in updating group Dp ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const getNewGroups = async (req, res) => {
  try {
    const existingRequests = await GroupRequest.find({
      senderId: req.user._id,
    });

    if (!existingRequests || existingRequests.length === 0) {
      const groups = await Group.find({ _id: { $nin: req.user.groups } });
      if (!groups) {
        return res.status(404).json({
          status: "error",
          message: "No groups at the moment",
        });
      }
      return res.status(200).json({
        status: "success",
        message: "Groups fetched successfully",
        data: groups,
      });
    }

    const avoidedGroups = existingRequests.map((request) => request.receiverId);
    const newGroups = await Group.find({
      $and: [
        { _id: { $nin: avoidedGroups } },
        { _id: { $nin: req.user.groups } },
      ],
    });

    if (!newGroups) {
      return res.status(404).json({
        status: "error",
        message: "New groups not avaialable right now ",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Groups fetched successfully",
      data: newGroups,
    });
  } catch (error) {
    console.log("Error in explorin new groups ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const getConnectionsToAddGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { connections } = req.query;
    const parsedConnections = JSON.parse(connections);
    const user = req.user;

    if (!mongoose.isValidObjectId(groupId)) {
      console.log(groupId);
      return res
        .status(400)
        .json({ status: "error", message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(400)
        .json({ status: "error", message: "Group not found" });
    }

    if (!group.members.includes(user._id)) {
      return res.status(401).json({
        status: "error",
        message: "Cannot add members without joining the group",
      });
    }

    if (
      group.admin.toString() !== user._id.toString() &&
      group.visibility !== "public"
    ) {
      return res.status(401).json({
        status: "error",
        message: "Only admin can add members in private groups",
      });
    }

    if (!parsedConnections || parsedConnections.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No connections to add members to group",
      });
    }

    const validConnections = [];
    for (const connection of parsedConnections) {
      if (!group.members.includes(connection._id)) {
        const user = await User.findById(connection._id);
        if (user) {
          const existingRequest = await GroupRequest.findOne({
            $or: [{ senderId: user._id }, { receiverId: user._id }],
            groupId: group._id,
          });
          if (!existingRequest) {
            validConnections.push(connection);
          }
        }
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Valid connections fetched successfully for adding to group",
      data: validConnections,
    });
  } catch (error) {
    console.log("Error in finding connections for group ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
