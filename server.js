const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// --- MongoDB接続 ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB 接続成功"))
  .catch(err => console.error("❌ MongoDB 接続エラー:", err));

// --- スキーマとモデル ---
const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: String
});
const Message = mongoose.model("Message", messageSchema);

// --- ソケット通信処理 ---
io.on("connection", async (socket) => {
  console.log("🟢 ユーザー接続");

  // 接続時に過去メッセージを送信
  const pastMessages = await Message.find().sort({ _id: 1 }).limit(100);
  socket.emit("chat history", pastMessages);

  // 新しいメッセージ受信
  socket.on("chat message", async (msgObj) => {
    // MongoDBに保存
    const newMsg = new Message(msgObj);
    await newMsg.save();

    // 全員に配信
    io.emit("chat message", msgObj);
  });

    // メッセージ削除イベント（誰でも削除可能）
    socket.on("delete message", async (id) => {
    await Message.findByIdAndDelete(id);
    io.emit("remove message", id);
    console.log(`🗑 メッセージ削除: ${id}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 ユーザー切断");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
