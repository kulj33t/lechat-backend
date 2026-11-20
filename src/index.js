import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { connectDB } from "./lib/db.js";
import cors from "cors";
import { corsOptions } from "./lib/cors.js";
import { app,server } from "./lib/socket.js";
import {authRoutes,messageRoutes,groupChatRoutes,groupRoutes,groupReqRoutes,userReqRoutes} from "./routes/index.js"


app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
const PORT = process.env.PORT;

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/group",groupRoutes);
app.use("/api/group/messages",groupChatRoutes);
app.use("/api/user/request",userReqRoutes)
app.use("/api/group/request",groupReqRoutes)

app.use("/api/ping",(req,res)=>{
  return res.status(200).json({message:"Pinged successfully"})
})


server.listen(PORT, () => {
  connectDB();
  console.log("Server is running on port", PORT);
});
