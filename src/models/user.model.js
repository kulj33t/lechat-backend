import mongoose, { Mongoose } from "mongoose";

const userSchema = mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minLength: 6,
    },
    profilePic: {
      type: String,
      default:
        "https://res.cloudinary.com/dzitsseoz/image/upload/v1732524043/blankDP/uwjpqauvpisbwynu7hpr.png",
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    groups:{
      type:[mongoose.Schema.Types.ObjectId],
      default:[],
      ref:"Group",
    },
    privacy:{
      type:Boolean,
      default:false
    },
    username:{
      type:String,
      maxLength:18,
      unique:true,
      required:true,
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
export default User;
