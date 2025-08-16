import mongoose from "mongoose";

const userReqSchema = mongoose.Schema(
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
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: {
        values: ["accepted", "rejected", "pending"],
        message: `{VALUE} is invalid user request status`,
      },
    },
  },
  {
    timestamps: true,
  }
);

const UserRequest = mongoose.model("UserRequest", userReqSchema);

export default UserRequest;
