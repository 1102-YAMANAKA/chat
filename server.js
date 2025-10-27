// =======================
// 📦 必要なモジュール読込
// =======================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

// =======================
// 🚀 サーバー基本設定
// =======================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// =======================
// 🔗 MongoDB 接続
// =======================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB 接続成功"))
  .catch(err => console.error("❌ MongoDB 接続エラー:", err));

// =======================
// 🧱 スキーマ & モデル定義
// =======================
const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: String,
  color: String,        // ← 名前ラベル色（HTMLと整合）
  senderKey: String     // ← 固有キー（必要に応じて使用）
});

const Message = mongoose.model("Message", messageSchema);

// =======================
// 💬 ソケット通信処理
// =======================
io.on("connection", async (socket) => {
  console.log("🟢 ユーザー接続");

  // --- 接続時に履歴を自動送信 ---
  try {
    const pastMessages = await Message.find().sort({ _id: 1 }).limit(100);
    console.log("📜 履歴送信:", pastMessages.length, "件");
    socket.emit("chat history", pastMessages);
  } catch (err) {
    console.error("履歴読み込みエラー:", err);
  }

  // --- 新しいメッセージ受信 ---
  socket.on("chat message", async (msgObj) => {
    try {
      // 保存用メッセージ生成
      const newMsg = new Message({
        name: msgObj.name,
        text: msgObj.text,
        timestamp: msgObj.timestamp,
        color: msgObj.color || null,
        senderKey: msgObj.senderKey || null
      });

      await newMsg.save();             // MongoDBに保存
      io.emit("chat message", newMsg); // 全員へ配信
    } catch (err) {
      console.error("メッセージ保存エラー:", err);
    }
  });

  // --- メッセージ削除 ---
  socket.on("delete message", async (id) => {
    try {
      await Message.findByIdAndDelete(id);
      io.emit("remove message", id); // 全員から削除
      console.log(`🗑 メッセージ削除: ${id}`);
    } catch (err) {
      console.error("削除エラー:", err);
    }
  });

  // --- 切断 ---
  socket.on("disconnect", () => {
    console.log("🔴 ユーザー切断");
  });
});

// =======================
// 🌐 サーバー起動
// =======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
