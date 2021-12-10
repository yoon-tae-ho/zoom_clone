import express from "express";
// import WebSocket from "ws";
import SocketIO from "socket.io";
import http from "http";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");

app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/*", (req, res) => {
  res.redirect("/");
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

let currentRoomName;
let currentNickname;

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName, nickname, localSocketId) => {
    currentRoomName = roomName;
    currentNickname = nickname;
    socket.join(roomName);
    socket.to(roomName).emit("welcome", nickname, localSocketId);
  });

  socket.on("offer", (offer, localSocketId, remoteSocketId, index) => {
    socket.to(remoteSocketId).emit("offer", offer, localSocketId, index);
  });

  socket.on("answer", (answer, remoteSocketId, localIndex, remoteIndex) => {
    socket.to(remoteSocketId).emit("answer", answer, localIndex, remoteIndex);
  });

  socket.on("ice", (ice, remoteSocketId, index) => {
    socket.to(remoteSocketId).emit("ice", ice, index);
  });

  socket.on("chat", (message, roomName) => {
    socket.to(roomName).emit("chat", message);
  });

  socket.on("disconnecting", () => {
    socket.to(currentRoomName).emit("leave_room", socket.id, currentNickname);
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
