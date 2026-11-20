import mongoose from "mongoose";
import Group from "../models/group.asign.model.js";
import User from "../models/user.model.js";
import GroupRequest from "../models/group.request.model.js";
import UserRequest from "../models/user.request.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { includesId, sameId } from "../lib/id.js";

export const sendInviteByAdmin = async (req, res) => {
  try {
    const { userId: receiverId, groupId } = req.body;
    const senderId = req.user._id;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(receiverId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid group or user id" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ status: "error", message: "Group not found to invite user" });
    }

    if (!sameId(group.admin, senderId)) {
      return res.status(401).json({
        status: "error",
        message: "Only admin can send invite to users",
      });
    }

    if (sameId(senderId, receiverId)) {
      return res.status(400).json({
        status: "error",
        message: "You cannot invite yourself",
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found to send invite" });
    }

    if (group.visibility !== "private" && receiver.privacy !== true) {
      return res.status(400).json({
        status: "error",
        message:
          "Cannot invite users to public group, instead you can add them.",
      });
    }

    if (includesId(group.members, receiverId)) {
      return res.status(400).json({
        status: "error",
        message: "Cannot send invite to members of group",
      });
    }

    const isConnection = await UserRequest.exists({
      status: "accepted",
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });
    if (!isConnection) {
      return res.status(403).json({
        status: "error",
        message: "You can only invite a connection",
      });
    }

    const existingRequest = await GroupRequest.findOne({
      groupId,
      status: "pending",
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: groupId },
      ],
    });
    if (existingRequest) {
      return res.status(400).json({
        status: "error",
        message: "A request for this group is already pending",
      });
    }

    const newGroupReq = new GroupRequest({ senderId, receiverId, groupId });
    await newGroupReq.save();

    const recieverSocketId = getReceiverSocketId(receiverId);
    if (recieverSocketId) {
      const data = {
        _id: newGroupReq._id,
        senderId: {
          _id: senderId,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        receiverId,
        groupId: {
          name: group.name,
          _id: group._id,
          photo: group.photo,
        },
        status: "pending",
      };
      io.to(recieverSocketId).emit("newGroupRequest", data);
    }

    return res.status(201).json({
      status: "success",
      message: "Group invite sent successfully",
      data: newGroupReq,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const sendInviteByUser = async (req, res) => {
  try {
    const user = req.user;
    const { groupId } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid group id" });
    }

    const existingRequest = await GroupRequest.findOne({
      groupId,
      status: "pending",
      $or: [{ senderId: user._id }, { receiverId: user._id }],
    });
    if (existingRequest) {
      return res.status(400).json({
        status: "error",
        message: "Request for this group already exists",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group not found to request by user",
      });
    }

    if (includesId(group.members, user._id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Already a member" });
    }

    if (group.visibility !== "private") {
      return res.status(400).json({
        status: "error",
        message:
          "Cannot send invite to public group, instead you can join them",
      });
    }

    const newRequest = new GroupRequest({
      senderId: user._id,
      receiverId: groupId,
      groupId,
    });
    await newRequest.save();

    const requester = await User.findById(user._id).select("fullName profilePic");
    const adminSocketId = getReceiverSocketId(String(group.admin));
    if (adminSocketId) {
      io.to(adminSocketId).emit("newGroupAdminRequest", {
        _id: newRequest._id,
        senderId: requester,
        receiverId: group._id,
        groupId: group._id,
        status: "pending",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Request sent successfully",
      data: newRequest,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const getGroupRequestsForUser = async (req, res) => {
  try {
    const user = req.user;
    const requests = await GroupRequest.find({
      receiverId: user._id,
      status: "pending",
    })
      .populate("senderId", "fullName profilePic")
      .populate("groupId", "name photo");

    if (!requests || requests.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No group requests at the moment",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Group requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    console.log("Error in getting group requests ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const getGroupRequestsForAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const user = req.user;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id-",
      });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group not found to get requests for admin",
      });
    }
    if (group.visibility === "public") {
      return res.status(400).json({
        status: "error",
        message: "Public groups will not have any requests",
      });
    }
    if (!sameId(group.admin, user._id)) {
      return res.status(401).json({
        status: "error",
        message: "Only admins can get the request of the users",
      });
    }
    const requests = await GroupRequest.find({
      receiverId: groupId,
      status: "pending",
    }).populate("senderId", "fullName profilePic");
    if (!requests || requests.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No requests at the moment",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    console.log("Error in getting requests for the admin ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const reviewInviteByAdmin = async (req, res) => {
  try {
    const { status } = req.params;
    const { reqId, groupId } = req.body;
    const user = req.user;
    if (!mongoose.isValidObjectId(reqId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request Id",
      });
    }

    if (status !== "accepted" && status !== "rejected") {
      return res.status(400).json({
        status: "error",
        message: "Invalid status for revewing request",
      });
    }
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }
    const request = await GroupRequest.findById(reqId).populate(
      "senderId",
      "groups"
    );
    if (!request) {
      return res.status(400).json({
        status: "error",
        message: "Request not found",
      });
    }
    if (request.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: "Request already reviewed",
      });
    }

    const group = await Group.findById(groupId).populate(
      "members",
      "fullName profilePic"
    );
    if (!group) {
      return res.status(400).json({
        status: "error",
        message: "Group not found",
      });
    }
    if (!sameId(request.groupId, groupId) || !sameId(request.receiverId, groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Incorrect request or group id ",
      });
    }
    if (!sameId(user._id, group.admin)) {
      return res.status(401).json({
        status: "error",
        message: "Only admins can review the requests",
      });
    }
    if (!request.senderId?._id) {
      await GroupRequest.findByIdAndDelete(request._id);
      return res.status(404).json({
        status: "error",
        message: "Request sender no longer exists",
      });
    }
    const newMember = await User.findById(request.senderId._id).select(
      "groups fullName profilePic"
    );
    if (!newMember) {
      return res.status(404).json({
        status: "error",
        message: "Request sender no longer exists",
      });
    }

    if (status === "rejected") {
      await GroupRequest.findByIdAndDelete(request._id);
      return res.status(200).json({
        status: "success",
        message: "Request rejected successfully",
      });
    }

    if (status === "accepted") {
      if (includesId(group.members, newMember._id)) {
        await GroupRequest.deleteMany({
          groupId,
          status: "pending",
          $or: [
            { senderId: newMember._id },
            { receiverId: newMember._id },
          ],
        });
        await group.populate("members", "fullName profilePic");
        return res.status(200).json({
          status: "success",
          message: "User is already a member of this group",
          data: group,
        });
      }
      group.members = [...group.members, newMember._id];
      if (!Array.isArray(newMember.groups)) newMember.groups = [];
      if (!includesId(newMember.groups, groupId)) newMember.groups.push(groupId);
      request.status = "accepted";
    }

    await newMember.save();
    await group.save();
    await request.save();
    await GroupRequest.deleteMany({
      _id: { $ne: request._id },
      groupId,
      status: "pending",
      $or: [
        { senderId: newMember._id },
        { receiverId: newMember._id },
      ],
    });
    await group.populate("members", "fullName profilePic");

    if (status === "accepted") {
      const recieverSocketId = getReceiverSocketId(newMember._id);
      if (recieverSocketId) {
        io.to(recieverSocketId).emit("newGroup", group);
      }
      for (const member of group.members) {
        const memberSocketId = getReceiverSocketId(member._id);
        const user = {
          _id: newMember._id,
          fullName: newMember.fullName,
          profilePic: newMember.profilePic,
        };
        if (memberSocketId) {
          io.to(memberSocketId).emit("newMember", { groupId, user });
        }
      }
    }
    return res.status(200).json({
      status: "success",
      message: `Request ${status} successfully`,
      data: group,
    });
  } catch (error) {
    console.log("Error in revewing request by admin ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const reviewInviteByUser = async (req, res) => {
  try {
    const user = req.user;
    const { groupId, reqId } = req.body;
    const { status } = req.params;
    if (status !== "accepted" && status !== "rejected") {
      return res.status(400).json({
        status: "error",
        message: "Invalid status",
      });
    }
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid group id",
      });
    }
    if (!mongoose.isValidObjectId(reqId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request id",
      });
    }
    const group = await Group.findById(groupId);
    const request = await GroupRequest.findById(reqId);
    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "No request recieved for this groupId",
      });
    }
    if (!group) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }
    if (request.status !== "pending") {
      return res.status(409).json({
        status: "error",
        message: "Request has already been reviewed",
      });
    }
    if (
      !sameId(request.receiverId, user._id) ||
      !sameId(request.groupId, groupId) ||
      !sameId(request.senderId, group.admin)
    ) {
      return res.status(403).json({
        status: "error",
        message: "This invitation does not belong to this user or group",
      });
    }

    if (includesId(group.members, user._id)) {
      await GroupRequest.deleteMany({
        groupId,
        status: "pending",
        $or: [{ senderId: user._id }, { receiverId: user._id }],
      });
      await group.populate("members", "fullName profilePic");
      return res.status(200).json({
        status: "success",
        message: "User is already a member of this group",
        data: group,
      });
    }

    if (status === "rejected") {
      await GroupRequest.findByIdAndDelete(request._id);
      return res.status(200).json({
        status: "success",
        message: "Request rejected successfully",
        data: user,
      });
    }
    
    if (status === "accepted") {
      group.members.push(user._id);
      if (!Array.isArray(user.groups)) user.groups = [];
      if (!includesId(user.groups, groupId)) user.groups.push(group._id);
      request.status = "accepted";
      await user.save();
      await group.save();
      await request.save();
      await GroupRequest.deleteMany({
        _id: { $ne: request._id },
        groupId,
        status: "pending",
        $or: [
          { senderId: user._id },
          { receiverId: user._id },
        ],
      });
      await group.populate("members", "fullName profilePic");
      const userSocketId = getReceiverSocketId(user._id);
      if (userSocketId) io.to(userSocketId).emit("newGroup", group);
      for (const member of group.members) {
        const memberSocketId = getReceiverSocketId(String(member?._id ?? member));
        const newUser = {
          _id: user._id,
          fullName: user.fullName,
          profilePic: user.profilePic,
        };
        if (memberSocketId) {
          io.to(memberSocketId).emit("newMember", { groupId, user: newUser });
        }
      }
      return res.status(200).json({
        status: "success",
        message: "Request accepted successfully",
        data: group,
      });
    }
  } catch (error) {
    console.log("Error while reviewing the request ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
