import cloudinary from "../lib/cloudinary.js";
import Group from "../models/group.asign.model.js";
import GroupChat from "../models/group.message.model.js";
import User from "../models/user.model.js";
import GroupRequest from "../models/group.request.model.js";
import UserRequest from "../models/user.request.model.js";
import mongoose from "mongoose";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { includesId, sameId } from "../lib/id.js";

export const createGroup = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 15) {
      return res.status(400).json({
        status: "error",
        message: "Group name must be between 1 and 15 characters",
      });
    }
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

    if (!includesId(admin.groups, newGroup._id)) {
      admin.groups = [...(admin.groups || []), newGroup._id];
    }
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

    if (!mongoose.isValidObjectId(memberToAdd)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid user id" });
    }
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

    const requesterIsAdmin = sameId(group.admin, req.user._id);
    const requesterIsMember = includesId(group.members, req.user._id);
    if (!requesterIsAdmin && (!requesterIsMember || group.visibility === "private")) {
      return res.status(403).json({
        status: "error",
        message: "Only group members can add members, and only admins can add to private groups",
      });
    }

    if (sameId(memberToAdd, req.user._id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Cannot add yourself to the group" });
    }

    if (includesId(group.members, memberToAdd)) {
      return res.status(400).json({
        status: "error",
        message: "Already a member fo group ",
      });
    }

    const user = await User.findById(memberToAdd).select(
      "fullName profilePic privacy groups"
    );
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

    const isConnection = await UserRequest.exists({
      status: "accepted",
      $or: [
        { senderId: req.user._id, receiverId: memberToAdd },
        { senderId: memberToAdd, receiverId: req.user._id },
      ],
    });
    if (!isConnection) {
      return res.status(403).json({
        status: "error",
        message: "You can only add a connection to this group",
      });
    }

    if (!Array.isArray(user.groups)) user.groups = [];
    if (!includesId(user.groups, groupId)) user.groups.push(groupId);
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
      return res.status(200).json({
        status: "success",
        message: "Groups fetched successfully",
        data: [],
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
    if (!mongoose.isValidObjectId(memberToRemove)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user id",
      });
    }
    if (sameId(memberToRemove, req.user._id)) {
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
    if (!sameId(group.admin, req.user._id)) {
      return res.status(400).json({
        status: "error",
        message: "only Admins can remove the members",
      });
    }
    if (!Array.isArray(user.groups) || user.groups.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "User is not joined in  group",
      });
    }
    if (!includesId(group.members, memberToRemove)) {
      return res.status(400).json({
        status: "error",
        message: "User is not in the group, can't remove",
      });
    }

    user.groups = user.groups.filter((userGroup) => !sameId(userGroup, groupId));
    group.members = group.members.filter((id) => !sameId(id, memberToRemove));

    await GroupRequest.deleteMany({
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

    const isMember = includesId(group.members, user._id);
    if (!includesId(user.groups, groupId) && !isMember) {
      return res.status(400).json({
        status: "error",
        message: "You must be part of the group to leave it",
      });
    }

    if (sameId(group.admin, user._id)) {
      return res.status(400).json({
        status: "error",
        message: "Admins cannot leave the group. They must delete it.",
      });
    }

    await GroupRequest.deleteMany({
      groupId,
      $or: [{ senderId: user._id }, { receiverId: user._id }],
    });

    group.members = group.members.filter((member) => !sameId(member, user._id));
    user.groups = (user.groups || []).filter(
      (userGroup) => !sameId(userGroup, groupId)
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
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group not found",
      });
    }

    if (group.visibility === "private") {
      return res.status(400).json({
        status: "error",
        message: "Group is private, request an invite to join",
      });
    }

    const isNewMember = !includesId(group.members, user._id);
    if (isNewMember) group.members.push(user._id);
    if (!Array.isArray(user.groups)) user.groups = [];
    if (!includesId(user.groups, group._id)) user.groups.push(group._id);

    await GroupRequest.deleteMany({
      groupId,
      status: "pending",
      $or: [
        { senderId: user._id, receiverId: groupId },
        { senderId: group.admin, receiverId: user._id },
      ],
    });

    await group.save();
    await user.save();

    await group.populate("members", "fullName profilePic");
    const userData = {
      _id: user._id,
      fullName: user.fullName,
      profilePic: user.profilePic,
    };
    const userSocketId = getReceiverSocketId(user._id);
    if (userSocketId) io.to(userSocketId).emit("newGroup", group);
    if (isNewMember) {
      for (const member of group.members) {
        const memberSocketId = getReceiverSocketId(String(member?._id ?? member));
        if (memberSocketId) {
          io.to(memberSocketId).emit("newMember", { groupId, user: userData });
        }
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Group joined successfully",
      data: group,
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

    if (!sameId(group.admin, req.user._id)) {
      return res.status(400).json({
        status: "error",
        message: "Only the admin can delete the group",
      });
    }
    for (const member of group.members) {
      member.groups = (member.groups || []).filter(
        (memberGroupId) => !sameId(memberGroupId, groupId)
      );
      await member.save();
    }

    await GroupChat.deleteMany({ groupId });
    await GroupRequest.deleteMany({ groupId });
    const groupMembers = group.members;
    await Group.findByIdAndDelete(groupId);
    for (const member of groupMembers) {
      const memberSocketId = getReceiverSocketId(String(member?._id ?? member));
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
    if (!sameId(group.admin, req.user._id)) {
      return res.status(400).json({
        status: "error",
        message: "Only admin can edit the group info",
      });
    }
    const wasPrivate = group.visibility === "private";
    const hasName = Object.prototype.hasOwnProperty.call(req.body, "newName");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");
    const hasVisibility = Object.prototype.hasOwnProperty.call(req.body, "visibility");
    if (!hasName && !hasDescription && !hasVisibility) {
      return res.status(400).json({
        status: "error",
        message: "At least one group field is required",
      });
    }

    if (hasName) {
      if (typeof newName !== "string" || !newName.trim() || newName.trim().length > 15) {
        return res.status(400).json({
          status: "error",
          message: "Group name must be between 1 and 15 characters",
        });
      }
      group.name = newName.trim();
    }
    if (hasDescription) {
      if (typeof description !== "string" || description.length > 200) {
        return res.status(400).json({
          status: "error",
          message: "Group description must be 200 characters or fewer",
        });
      }
      group.description = description.trim();
    }
    if (hasVisibility) {
      if (!["private", "public"].includes(visibility)) {
        return res.status(400).json({
          status: "error",
          message: "Visibility must be public or private",
        });
      }
      group.visibility = visibility;
    }
    await group.save();
    if (wasPrivate && group.visibility === "public") {
      await GroupRequest.deleteMany({
        groupId,
        status: "pending",
        senderId: { $ne: group.admin },
        receiverId: groupId,
      });
    }
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
    if (!sameId(group.admin, req.user._id)) {
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
    const pendingRequests = await GroupRequest.find({
      status: "pending",
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }],
    }).select("groupId");
    const groupsWhereMember = await Group.find({ members: req.user._id }).select("_id");
    const hiddenGroupIds = [
      ...(req.user.groups || []).map((group) => group._id || group),
      ...groupsWhereMember.map((group) => group._id),
      ...pendingRequests.map((request) => request.groupId),
    ];
    const newGroups = await Group.find({ _id: { $nin: hiddenGroupIds } });
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
    let parsedConnections;
    try {
      parsedConnections = JSON.parse(connections || "[]");
    } catch {
      return res.status(400).json({
        status: "error",
        message: "Invalid connections list",
      });
    }
    const user = req.user;
    if (!Array.isArray(parsedConnections)) {
      return res.status(400).json({
        status: "error",
        message: "Connections must be a list",
      });
    }

    if (!mongoose.isValidObjectId(groupId)) {
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

    if (!includesId(group.members, user._id)) {
      return res.status(401).json({
        status: "error",
        message: "Cannot add members without joining the group",
      });
    }

    if (
      !sameId(group.admin, user._id) &&
      group.visibility !== "public"
    ) {
      return res.status(401).json({
        status: "error",
        message: "Only admin can add members in private groups",
      });
    }

    const requestedIds = [
      ...new Set(
        parsedConnections
          .map((connection) => connection?._id)
          .filter((id) => mongoose.isValidObjectId(id))
          .map(String)
      ),
    ];
    if (requestedIds.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No connections available to add",
        data: [],
      });
    }

    const acceptedRequests = await UserRequest.find({
      status: "accepted",
      $or: [
        { senderId: user._id, receiverId: { $in: requestedIds } },
        { receiverId: user._id, senderId: { $in: requestedIds } },
      ],
    }).select("senderId receiverId");
    const acceptedIds = new Set(
      acceptedRequests.map((request) =>
        sameId(request.senderId, user._id)
          ? String(request.receiverId)
          : String(request.senderId)
      )
    );
    const pendingRequests = await GroupRequest.find({
      groupId: group._id,
      status: "pending",
      $or: [
        { senderId: { $in: requestedIds } },
        { receiverId: { $in: requestedIds } },
      ],
    }).select("senderId receiverId");
    const pendingIds = new Set(
      pendingRequests.map((request) =>
        sameId(request.senderId, group.admin)
          ? String(request.receiverId)
          : String(request.senderId)
      )
    );
    const candidates = await User.find({
      _id: { $in: [...acceptedIds] },
      privacy: { $ne: true },
    }).select("fullName profilePic");
    const validConnections = candidates.filter(
      (connection) =>
        !includesId(group.members, connection._id) &&
        !pendingIds.has(String(connection._id))
    );

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
