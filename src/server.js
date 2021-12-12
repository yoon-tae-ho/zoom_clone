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

let socketObjArr = [];

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName, nickname) => {
    const newSocketObj = {
      socketId: socket.id,
      roomName,
      nickname,
    };
    socketObjArr.push(newSocketObj);
    socket.join(roomName);
    socket.to(roomName).emit("welcome", nickname, socket.id);
  });

  socket.on("offer", (offer, remoteSocketId, index, localNickname) => {
    socket
      .to(remoteSocketId)
      .emit("offer", offer, socket.id, index, localNickname);
  });

  socket.on("answer", (answer, remoteSocketId, localIndex, remoteIndex) => {
    socket.to(remoteSocketId).emit("answer", answer, localIndex, remoteIndex);
  });

  socket.on("ice", (ice, remoteSocketId, localDescription) => {
    socket.to(remoteSocketId).emit("ice", ice, localDescription);
  });

  socket.on("chat", (message, roomName) => {
    socket.to(roomName).emit("chat", message);
  });

  socket.on("disconnecting", () => {
    socketObjArr.forEach((socketObj) => {
      if (socket.id === socketObj.socketId) {
        socket
          .to(socketObj.roomName)
          .emit("leave_room", socket.id, socketObj.nickname);
      }
    });
  });
});

const handleListen = () => console.log(`✅ Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
