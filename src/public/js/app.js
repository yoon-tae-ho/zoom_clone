const socket = io();

const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const muteIcon = muteBtn.querySelector(".muteIcon");
const unMuteIcon = muteBtn.querySelector(".unMuteIcon");
const cameraBtn = document.querySelector("#camera");
const cameraIcon = cameraBtn.querySelector(".cameraIcon");
const unCameraIcon = cameraBtn.querySelector(".unCameraIcon");
const camerasSelect = document.querySelector("#cameras");

const call = document.querySelector("#call");
const welcome = document.querySelector("#welcome");

const HIDDEN_CN = "hidden";

let myStream;
let muted = true;
unMuteIcon.classList.add(HIDDEN_CN);
let cameraOff = false;
unCameraIcon.classList.add(HIDDEN_CN);
let roomName;
let nickname;
let peopleInRoom = 1;

const peerConnectionObjArr = [];

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks();
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;

      if (currentCamera.label == camera.label) {
        option.selected = true;
      }

      camerasSelect.appendChild(option);
    });
  } catch (error) {
    console.log(error);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );

    // mute default
    myStream //
      .getAudioTracks()
      .forEach((track) => (track.enabled = false));

    // stream을 mute하는 것이 아니라 HTML video element를 mute한다.
    myFace.srcObject = myStream;
    myFace.muted = true;

    if (!deviceId) {
      await getCameras();
    }
  } catch (error) {
    console.log(error);
  }
}

function handleMuteClick() {
  myStream //
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (muted) {
    unMuteIcon.classList.remove(HIDDEN_CN);
    muteIcon.classList.add(HIDDEN_CN);
    muted = false;
  } else {
    muteIcon.classList.remove(HIDDEN_CN);
    unMuteIcon.classList.add(HIDDEN_CN);
    muted = true;
  }
}

function handleCameraClick() {
  myStream //
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraIcon.classList.remove(HIDDEN_CN);
    unCameraIcon.classList.add(HIDDEN_CN);
    cameraOff = false;
  } else {
    unCameraIcon.classList.remove(HIDDEN_CN);
    cameraIcon.classList.add(HIDDEN_CN);
    cameraOff = true;
  }
}

async function handleCameraChange() {
  try {
    await getMedia(camerasSelect.value);
    if (peerConnectionObjArr.length > 0) {
      const newVideoTrack = myStream.getVideoTracks()[0];
      peerConnectionObjArr.forEach((peerConnectionObj) => {
        const peerConnection = peerConnectionObj.connection;
        const peerVideoSender = peerConnection
          .getSenders()
          .find((sender) => sender.track.kind == "video");
        peerVideoSender.replaceTrack(newVideoTrack);
      });
    }
  } catch (error) {
    console.log(error);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (choose room)

call.classList.add(HIDDEN_CN);
// welcome.hidden = true;

const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.classList.remove(HIDDEN_CN);
  await getMedia();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const welcomeRoomName = welcomeForm.querySelector("#roomName");
  const welcomeNickname = welcomeForm.querySelector("#nickname");
  roomName = welcomeRoomName.value;
  welcomeRoomName.value = "";
  nickname = welcomeNickname.value;
  welcomeNickname.value = "";
  await initCall();
  socket.emit("join_room", roomName, nickname, socket.id);
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Chat Form

const chatForm = document.querySelector("#chatForm");
const chatBox = document.querySelector("#chatBox");

chatForm.addEventListener("submit", handleChatSubmit);

function handleChatSubmit(event) {
  event.preventDefault();
  const chatInput = chatForm.querySelector("input");
  const message = chatInput.value;
  chatInput.value = "";
  socket.emit("chat", `${nickname}: ${message}`, roomName);
  writeChat(`You: ${message}`);
}

function writeChat(message) {
  const li = document.createElement("li");
  const span = document.createElement("span");
  span.innerText = message;
  li.appendChild(span);
  chatBox.appendChild(li);
}

// Leave Room

const leaveBtn = document.querySelector("#leave");

function leaveRoom() {
  socket.disconnect();

  call.classList.add(HIDDEN_CN);
  welcome.hidden = false;

  peerConnectionObjArr = [];
  peopleInRoom = 1;
  myStream = "";

  clearAllVideos();
}

function removeVideo(leavedSocketId) {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((streamElement) => {
    if (streamElement.id === leavedSocketId) {
      streams.removeChild(streamElement);
    }
  });
}

function clearAllVideos() {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((streamElement) => {
    streams.removeChild(streamElement);
  });
}

leaveBtn.addEventListener("click", leaveRoom);

// socket code

socket.on("welcome", async (nickname, remoteSocketId) => {
  try {
    createConnection();
    const index = peerConnectionObjArr.length - 1;
    peerConnectionObjArr[index].remoteSocketId = remoteSocketId;
    const offer = await peerConnectionObjArr[index].connection.createOffer();
    peerConnectionObjArr[index].connection.setLocalDescription(offer);
    socket.emit(
      "offer",
      offer,
      peerConnectionObjArr[index].localSocketId,
      remoteSocketId,
      index
    );
  } catch (error) {
    console.log(error);
  }

  writeChat(`notice! ${nickname} joined the room`);
});

socket.on("offer", async (offer, remoteSocketId, remoteIndex) => {
  try {
    createConnection();
    const index = peerConnectionObjArr.length - 1;
    peerConnectionObjArr[index].remoteSocketId = remoteSocketId;
    peerConnectionObjArr[index].remoteIndex = remoteIndex;
    peerConnectionObjArr[index].connection.setRemoteDescription(offer);
    const answer = await peerConnectionObjArr[index].connection.createAnswer();
    peerConnectionObjArr[index].connection.setLocalDescription(answer);
    socket.emit("answer", answer, remoteSocketId, index, remoteIndex);
  } catch (error) {
    console.log(error);
  }
});

socket.on("answer", (answer, remoteIndex, localIndex) => {
  peerConnectionObjArr[localIndex].connection.setRemoteDescription(answer);
  peerConnectionObjArr[localIndex].remoteIndex = remoteIndex;
});

socket.on("ice", async (ice, index) => {
  await peerConnectionObjArr[index].connection.addIceCandidate(ice);
});

socket.on("chat", (message) => {
  writeChat(message);
});

socket.on("leave_room", (leavedSocketId, nickname) => {
  removeVideo(leavedSocketId);
  writeChat(`notice! ${nickname} leaved the room.`);
  --peopleInRoom;
  sortStreams();
  console.log("disconnected!!!");
});

// RTC code

function createConnection() {
  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  // myPeerConnection.addEventListener(
  //   "iceconnectionstatechange",
  //   handleConnectionStateChange
  // );
  myStream //
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));

  peerConnectionObjArr.push({
    connection: myPeerConnection,
    localSocketId: socket.id,
  });
  ++peopleInRoom;
  sortStreams();
}

function handleIce(event) {
  peerConnectionObjArr.forEach((peerConnectionObj) => {
    if (event.target === peerConnectionObj.connection) {
      socket.emit(
        "ice",
        event.candidate,
        peerConnectionObj.remoteSocketId,
        peerConnectionObj.remoteIndex
      );
    }
  });
}

function handleAddStream(event) {
  const peerStream = event.stream;
  peerConnectionObjArr.forEach((peerConnectionObj) => {
    if (event.target === peerConnectionObj.connection) {
      paintPeerFace(peerStream, peerConnectionObj.remoteSocketId);
    }
  });
}

function paintPeerFace(peerStream, id) {
  const streams = document.querySelector("#streams");
  const div = document.createElement("div");
  div.id = id;
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.width = "400";
  video.height = "400";
  video.srcObject = peerStream;

  div.appendChild(video);
  streams.appendChild(div);
  sortStreams();
}

// function handleConnectionStateChange(event) {
//   console.log(
//     `${peerConnectionObjArr.length - 1} CS: ${event.target.connectionState}`
//   );
//   console.log(
//     `${peerConnectionObjArr.length - 1} ICS: ${event.target.iceConnectionState}`
//   );

//   if (event.target.iceConnectionState === "disconnected") {
//   }
// }

function sortStreams() {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((stream) => (stream.className = `people${peopleInRoom}`));
}
