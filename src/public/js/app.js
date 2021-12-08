const socket = io();

const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const cameraBtn = document.querySelector("#camera");
const camerasSelect = document.querySelector("#cameras");

const call = document.querySelector("#call");
const welcome = document.querySelector("#welcome");

let myStream;
let muted = true;
let cameraOff = false;
let roomName;
let nickname;
let myPeerConnection;
let chatDataChannel;

async function getCameras() {
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks();
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;

            if (currentCamera.label == camera.label) {
                option.selected = true
            }

            camerasSelect.appendChild(option);
        });
    } catch(error) {
        console.log(error);
    }
}

async function getMedia(deviceId) {
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" }
    };
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } }
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        );

        // mute default
        myStream    //
            .getAudioTracks()
            .forEach(track => track.enabled = false);

        // stream을 mute하는 것이 아니라 HTML video element를 mute한다.
        myFace.srcObject = myStream;
        myFace.muted = true;
        
        if (!deviceId) {
            await getCameras();
        }
    } catch(error){
        console.log(error);
    }
};

function handleMuteClick() {
    myStream    //
        .getAudioTracks()
        .forEach(track => track.enabled = !track.enabled);
    if (muted) {
        muteBtn.innerText = "Mute";
        muted = false;
    } else {
        muteBtn.innerText = "Unmute";
        muted = true;
    }
}

function handleCameraClick() {
    myStream    //
        .getVideoTracks()
        .forEach(track => track.enabled = !track.enabled);
    if (cameraOff) {
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    try{
        await getMedia(camerasSelect.value);
        if (myPeerConnection) {
            const newVideoTrack = myStream.getVideoTracks()[0];
            const peerVideoSender = myPeerConnection    
                .getSenders()
                .find(sender => sender.track.kind == "video");
            peerVideoSender.replaceTrack(newVideoTrack);
        }
    } catch(error) {
        console.log(error);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (choose room)

call.hidden = true;

const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    createConnection();
};

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const welcomeRoomName = welcomeForm.querySelector("#roomName");
    const welcomeNickname = welcomeForm.querySelector("#nickname");
    roomName = welcomeRoomName.value;
    welcomeRoomName.value = "";
    nickname = welcomeNickname.value;
    welcomeNickname.value = "";
    await initCall();
    socket.emit("join_room", roomName, nickname);
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
    chatDataChannel.send(`${nickname}: ${message}`);
    writeChat(`<strong>You</strong>: ${message}`);
}

function writeChat(message) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.innerText = message;
    li.appendChild(span);
    chatBox.appendChild(li);
}

// socket code

socket.on("welcome", async (nickname) => {
    try{
        chatDataChannel = myPeerConnection.createDataChannel("chat");
        chatDataChannel.addEventListener("message", event => writeChat(event.data));
        const offer = await myPeerConnection.createOffer();
        myPeerConnection.setLocalDescription(offer);
        socket.emit("offer", offer, roomName);
    } catch(error) {
        console.log(error);
    }

    writeChat(`notice! ${nickname} joined the room`);
});

socket.on("offer", async (offer) => {
    try {
        myPeerConnection.setRemoteDescription(offer);
        myPeerConnection.addEventListener("datachannel", (event) => {
            chatDataChannel = event.channel;
            chatDataChannel.addEventListener("message", event => writeChat(event.data));
        });
        const answer = await myPeerConnection.createAnswer();
        myPeerConnection.setLocalDescription(answer);
        socket.emit("answer", answer, roomName);
    } catch(error) {
        console.log(error);
    }
});

socket.on("answer", (answer) => {
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
    myPeerConnection.addIceCandidate(ice);
});

// RTC code

function createConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302"
                ]
            }
        ]
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream    //
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(event) {
    socket.emit("ice", event.candidate, roomName);
}

function handleAddStream(event) {
    const peerStream = event.stream;
    // const peerFace = document.querySelector("#peerFace");
    // peerFace.srcObject = peerStream;
    paintPeerFace(peerStream);
}

function paintPeerFace(peerStream) {
    const streams = document.querySelector("#streams");
    const div = document.createElement("div");
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = "400px";
    video.style.height = "400px";
    video.srcObject = peerStream;

    div.appendChild(video);
    streams.appendChild(div);
}