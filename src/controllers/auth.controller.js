import { generateMailToken, generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import validator from "validator";
import cloudinary from "../lib/cloudinary.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  const username = req.body.username.trim();

  try {
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "All fields are required" });
    }
    if (username.length > 18) {
      return res.status(400).json({
        status: "error",
        message: "Username cant be more than 18 characters",
      });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        status: "error",
        message: "Username contains invalid characters",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid email",
      });
    }

    if (!validator.isStrongPassword(password)) {
      return res.status(400).json({
        status: "error",
        message: "Please enter a strong password",
      });
    }

    const user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ status: "error", message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      email,
      password: hashPassword,
      fullName,
      username,
    });

    await newUser.save();
    const mailOptions = {
      from: `"Chit-Chat Team" <${process.env.EMAIL}>`,
      to: email,
      subject: "Welcome to Chit-Chat!",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img 
              src="https://res.cloudinary.com/dzitsseoz/image/upload/v1733583250/BaatCheet/ldn8ikrtjvbs8suhgz62.png" 
              alt="Chit-Chat Logo" 
              style="width: 120px; height: 120px; object-fit:cover; border-radius: 50%;"
            />
          </div>
          <h2 style="color: #444; text-align: center;">Welcome to Chit-Chat, ${newUser.fullName}!</h2>
          <p>We’re excited to have you as part of our growing community. With Chit-Chat, you can now stay connected with friends, meet new people, and engage in conversations that matter to you.</p>
          <p>Your account has been successfully created, and you can start chatting right away!</p>
          <p>If you ever need assistance or have any questions, our team is here to help.</p>
          <p>We’re looking forward to seeing you around, and we hope you enjoy your time with Chit-Chat.</p>
          <p>Best regards,<br>Chit-Chat Team</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">If you need any assistance, feel free to <a href="mailto:vermadheeraj945@gmail.com" style="color: #007BFF;">contact us</a>.</p>
        </div>
      `,
    };
    generateToken(newUser._id, res);
    await transporter.sendMail(mailOptions);
    return res.status(201).json({
      status: "success",
      message: "Successfully created user account",
      data: newUser,
    });
  } catch (error) {
    console.log("Error in signup controller", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ status: "error", message: "Enter a valid email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid credentials" });
    }

    const isValidPass = await bcrypt.compare(password, user.password);
    if (!isValidPass) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid credentials" });
    }
    const mailOptions = {
      from: `"Chit-Chat" <${process.env.EMAIL}>`,
      to: email,
      subject: "Login Activity Notification",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img 
              src="https://res.cloudinary.com/dzitsseoz/image/upload/v1733583250/BaatCheet/ldn8ikrtjvbs8suhgz62.png" 
              alt="Chit-Chat Logo" 
              style="width: 120px; height: 120px; object-fit:cover; border-radius: 50%;"
            />
          </div>
          <h2 style="color: #444; text-align: center;">Login Activity Alert</h2>
          <p>Dear ${user.fullName},</p>
          <p>We noticed a new login to your Chit-Chat account. If this was you, you can safely ignore this message.</p>
          <p>If this wasn't you, please secure your account immediately by changing your password using the link below:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a 
              href="${process.env.BASE_URL}" 
              style="
                text-decoration: none; 
                background-color: #007BFF; 
                color: white; 
                padding: 12px 24px; 
                border-radius: 5px; 
                font-size: 16px;
                font-weight: bold;
                display: inline-block;"
            >
              Change Password
            </a>
          </div>
          <p>Thank you for being a part of the Chit-Chat community. If you have any concerns, please contact us immediately.</p>
          <p>Thank you,<br>Chit-Chat Team</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
           <p style="font-size: 12px; color: #888; text-align: center;">If you need any assistance, feel free to <a href="mailto:vermadheeraj945@gmail.com" style="color: #007BFF;">contact us</a>.</p></div>
      `,
    };

    generateToken(user._id, res);
    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      status: "success",
      message: "Logged in successfully",
      data: user,
    });
  } catch (error) {
    console.log("Error in login controller", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  try {
        res.cookie("jwt", null, {
        expires: new Date(Date.now()),
        sameSite:"None",
        secure:true,
    });

    return res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const user = req.user;
    if (!profilePic) {
      return res.status(400).json({
        status: "error",
        message: "Profile pic feild is required",
      });
    }

    const response = await cloudinary.uploader.upload(profilePic, {
      folder: "BaatCheet/ProfilePics",
    });
    user.profilePic = response.secure_url;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.log("Error in updating profile", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const userAuth = (req, res) => {
  try {
    return res.status(200).json({
      status: "success",
      message: "Profile fetched succesfully",
      data: req.user,
    });
  } catch (error) {
    console.log("Error in checking user profile", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currPass, newPass } = req.body;
    if (!currPass || !newPass) {
      return res.status(400).json({
        status: "error",
        message: "Both existing and new password fields are required",
      });
    }
    const user = req.user;
    const passMatch = await bcrypt.compare(currPass, user.password);
    if (!passMatch) {
      return res.status(400).json({
        status: "error",
        message: "Wrong existing password",
      });
    }

    if (!validator.isStrongPassword(newPass)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a strong new password",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newPassHash = await bcrypt.hash(newPass, salt);
    user.password = newPassHash;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password updated successfully",
      data: user,
    });
  } catch (error) {
    console.log("Error in updating password", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const sendResetMail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid email address",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No account exists with this email",
      });
    }

    const token = await generateMailToken();
    const resetLink = `${
      process.env.BASE_URL
    }/reset-password/verify?email=${encodeURIComponent(
      email
    )}&token=${encodeURIComponent(token)}`;
    const mailOptions = {
      from: `"Chit-Chat" <${process.env.EMAIL}>`,
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img 
              src="https://res.cloudinary.com/dzitsseoz/image/upload/v1733583250/BaatCheet/ldn8ikrtjvbs8suhgz62.png" 
              alt="Chit-Chat Logo" 
              style="width: 120px; height: 120px; object-fit:cover; border-radius: 50%;"
            />
          </div>
          <h2 style="color: #444; text-align: center;">Password Reset Request</h2>
          <p>Dear ${user.fullName},</p>
          <p>We received a request to reset your password for your Chit-Chat account. If you made this request, please click the button below to reset your password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a 
              href="${resetLink}" 
              style="
                text-decoration: none; 
                background-color: #007BFF; 
                color: white; 
                padding: 12px 24px; 
                border-radius: 5px; 
                font-size: 16px;
                font-weight: bold;
                display: inline-block;"
            >
              Reset Password
            </a>
          </div>
          <p>This link will expire in 5 minutes. If you did not request this, please ignore this email. Your account remains secure.</p>
          <p>Thank you,<br>Chit-Chat Team</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
           <p style="font-size: 12px; color: #888; text-align: center;">If you need any assistance, feel free to <a href="mailto:vermadheeraj945@gmail.com" style="color: #007BFF;">contact us</a>.</p>     </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 300000;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.log("Error sending mail ->", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const verifyMailTokenAndChangePass = async (req, res) => {
  const { token, email, newPass } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (
      !user.resetPasswordToken ||
      !user.resetPasswordExpires ||
      token !== user.resetPasswordToken
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid token",
      });
    }

    if (Date.now() >= user.resetPasswordExpires) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(400).json({
        status: "error",
        message: "Link expired",
      });
    }
    if (!validator.isStrongPassword(newPass)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a strong new password",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newPassHash = await bcrypt.hash(newPass, salt);
    user.password = newPassHash;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "An error occurred while resetting the password",
    });
  }
};

export const validateUserName = async (req, res) => {
  const username = req.params.username.trim();
  try {
    if (username.length < 4) {
      return res.status(400).json({
        status: "error",
        message: "Username must be atleast 4 characters",
      });
    }
    if (username.length > 18) {
      return res.status(400).json({
        status: "error",
        message: "Username cant be more than 18 characters",
      });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        status: "error",
        message: "Username contains invalid characters",
      });
    }
    const existingUserName = await User.findOne({ username });
    if (!existingUserName) {
      return res.status(200).json({
        status: "success",
        message: "Username is available",
      });
    }
    return res.status(404).json({
      status: "error",
      message: "Username not available",
    });
  } catch (error) {
    console.log("Error in validatingUserName ->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updatePrivacy = async (req, res) => {
  try {
    const user = req.user;
    const { privacy } = req.body;
    if (privacy !== true && privacy !== false) {
      return res.status(400).json({
        status: "error",
        message: "Invalid privacy status",
      });
    }
    user.privacy = privacy;
    await user.save();
    return res.status(200).json({
      status: "success",
      message: "Privacy updated successfully",
      data: user,
    });
  } catch (error) {
    console.log("Error updating  privacy of user->", error?.message);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
