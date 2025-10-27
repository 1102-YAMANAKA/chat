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



  // 接続時に過去メッセージ送信
  const pastMessages = await Message.find().sort({ _id: 1 }).limit(100);
  socket.emit("chat history", pastMessages);



  // 🔹 クライアントから履歴リクエストを受け取ったとき
  socket.on("request history", async () => {
    try {
      const messages = await Message.find().sort({ _id: 1 }).limit(100);
      socket.emit("chat history", messages);
    } catch (err) {
      console.error("履歴送信エラー:", err);
    }
  });



// M-9 新しいメッセージを受信
socket.on("chat message", async (msgObj) => {
  try {
    // senderKeyを確実に保持したオブジェクトを作成
    const safeMsg = {
      ...msgObj,
      senderKey: msgObj.senderKey || null
    };



    // MongoDBへ保存
    const newMsg = new Message(safeMsg);
    await newMsg.save();



    // 他のクライアントへもsenderKey付きで送信
    io.emit("chat message", newMsg);
  } catch (err) {
    console.error("メッセージ保存エラー:", err);
  }
});



  // 🔹 メッセージ削除処理（管理者・誰でもOK）
  socket.on("delete message", async (id) => {
    try {
      await Message.findByIdAndDelete(id);
      io.emit("remove message", id); // 全員の画面から削除
      console.log(`🗑 メッセージ削除: ${id}`);
    } catch (err) {
      console.error("削除エラー:", err);
    }
  });



  socket.on("disconnect", () => {
    console.log("🔴 ユーザー切断");
  });
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
