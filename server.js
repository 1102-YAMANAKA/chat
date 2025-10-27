const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ✅ Render無料環境対応：CORS＋Ping設定
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 60000
});

app.use(express.static(path.join(__dirname, "public")));

// --- MongoDB接続 ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB 接続成功"))
  .catch(err => console.error("❌ MongoDB 接続エラー:", err));

// --- スキーマとモデル ---
const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: String,
  color: String,
  senderKey: String
});
const Message = mongoose.model("Message", messageSchema);

// --- 履歴送信共通関数 ---
async function sendHistory(socket) {
  try {
    const messages = await Message.find().sort({ _id: 1 }).limit(100).lean();
    socket.emit("chat history", messages);
    console.log("📜 履歴送信:", messages.length, "件");
  } catch (err) {
    console.error("履歴送信エラー:", err);
  }
}

// --- ソケット通信処理 ---
io.on("connection", (socket) => {
  console.log("🟢 ユーザー接続");

  // 履歴送信（Render対策で2段階）
  sendHistory(socket);
  setTimeout(() => sendHistory(socket), 1000);

  // メッセージ送信
  socket.on("chat message", async (msgObj) => {
    try {
      const newMsg = new Message({
        ...msgObj,
        color: msgObj.color || null,
        senderKey: msgObj.senderKey || null
      });
      await newMsg.save();
      io.emit("chat message", newMsg);
    } catch (err) {
      console.error("メッセージ保存エラー:", err);
    }
  });

  // メッセージ削除
  socket.on("delete message", async (id) => {
    try {
      await Message.findByIdAndDelete(id);
      io.emit("remove message", id);
      console.log(`🗑 メッセージ削除: ${id}`);
    } catch (err) {
      console.error("削除エラー:", err);
    }
  });

  socket.on("disconnect", () => console.log("🔴 ユーザー切断"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
