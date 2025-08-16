import mongoose from "mongoose";

const groupMessageSchema = mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Group",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    isRead: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
  }
);
const GroupChat = mongoose.model("GroupChat", groupMessageSchema);

export default GroupChat;
