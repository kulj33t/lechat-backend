import mongoose, { mongo } from "mongoose";

const groupReqSchema = mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Group",
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: {
        values: ["accepted", "rejected", "pending"],
        message: `{VALUE} is invalid group request status`,
      },
    },
  },
  {
    timestamps: true,
  }
);

const GroupRequest = mongoose.model("GroupRequest", groupReqSchema);

export default GroupRequest;
