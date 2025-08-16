import mongoose from "mongoose";

const groupSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxLength: 200,
      default: "",
    },
    photo: {
      type: String,
      default:
        "https://res.cloudinary.com/dzitsseoz/image/upload/v1732895657/blankDP/dlqp7rkz2oczjbogrmr7.jpg",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Users",
    },
    visibility: {
      type: String,
      required: true,
      default: "public",
      enum: {
        values: ["public", "private"],
        message: `{Value} is invalid visibility type`,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Group = mongoose.model("Group", groupSchema);
export default Group;
