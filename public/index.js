window.onload = () => {
  init();
}

const WS_PORT = 5000;
const consumers = new Map();
const clients = new Map();

let peer = null;
let localStream = null;
let localUUID = null;
let connection = null;

const username = document.querySelector('#username');
const remoteContainer = document.querySelector('#remote_videos');
const connectBtn = document.querySelector('#connect');

const mediaConstraint = {
  audio: true,
  video: {
    width: { min: 320, max: 1280 },
    height: { min: 180 },
    facingMode: 'user'
  }
}

const iceConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.stunprotocol.org", 
        "stun:stun.1.google.com:19302", 
        "stun:stun.3.google.com:19302", 
        "stun:stun.3.google.com:19302", 
        "stun:stun.4.google.com:19302"
      ]
    }
  ]
}

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
}

const recalculateLayout = () => {
  const container = remoteContainer;
  const videoContainer = document.querySelector('.videos_inner');
  const videoCount = document.querySelectorAll('.videoWrap').length;

  if(videoCount >= 3) {
    videoContainer.style.setProperty("--grow", 0 + "");
  }
  else {
    videoContainer.style.setProperty("--grow", 1 + "");
  }
}

const handleRemoteTrack = (stream, username) => {
  const userVideo = document.querySelector(`#remote_${username}`);
  if(userVideo) {
    userVideo.srcObject.addTrack(stream.getTracks()[0]);
  }
  else {
    const video = document.createElement('video');
    video.id = `remote_${username}`;
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = (username == username);

    const div = document.createElement('div');
    div.id = `user_${username.value}`;
    div.classList.add('videoWrap');

    const nameContainer = document.createElement('div');
    nameContainer.classList.add('display_name');

    const textNode = document.createTextNode(username);
    
    nameContainer.appendChild(textNode);

    div.appendChild(nameContainer);
    div.appendChild(video);

    document.querySelector('.videos-inner').appendChild(div);
  }

  // recalculateLayout();
}

const createConsumeTransport = async (peer) => {
  const consumerId = uuidv4();
  const consumerTransport = new RTCPeerConnection(iceConfig);
  consumerTransport.id = consumerId;
  consumerTransport.peer = peer;

  clients.get(peer.id).consumerId = consumerId;
  
  consumers.set(consumerId, consumerTransport);
  consumers.get(consumerId).addTransceiver('video', { direction: 'recvonly' });
  consumers.get(consumerId).addTransceiver('audio', { direction: 'recvonly' });

  const offer = await consumers.get(consumerId).createOffer();
  await consumers.get(consumerId).setLocalDescription(offer);

  consumers.get(consumerId).onicecandidate = async (event) => {
    const candidate = event.candidate;
    if(candidate && candidate.candidate && candidate.candidate.length > 0) {
      const payload = {
        type: 'consumer_ice',
        ice: candidate,
        id: peer.id
      }
      await connection.send(JSON.stringify(payload));
    }
  }

  consumers.get(consumerId).ontrack = (event) => {
    handleRemoteTrack(event.streams[0], peer.username);
  }

  return consumerTransport;
}

const consume = async (peer) => {
  const transport = await createConsumeTransport(peer);

  const payload = {
    type: 'consume',
    producerId: peer.id,
    consumerId: transport.id,
    sdp: transport.localDescription
  }

  connection.send(JSON.stringify(payload));
}

const handleAnswer = async (msg) => {
  const desc = new RTCSessionDescription(msg.sdp);
  await peer.setRemoteDescription(desc);
}

const handlePeers = async (msg) => {
  const peers = msg.peers;
  if(peers.length > 0) {
    for(const peer in peers) {
      clients.set(peers[peer].id, peers[peer]);
      await consume(peers[peer]);
    }
  }
}

const handleConsume = async (msg) => {
  const desc = new RTCSessionDescription(msg.sdp);
  await consumers.get(msg.consumerId).setRemoteDescription(desc);
}

const handleNewProducer = async (msg) => {
  if(msg.id === localUUID) return;
  const _peer = { id: msg.id, username: msg.username };
  clients.set(msg.id, _peer);
  
  await consume(_peer);
}

const removeUser = (msg) => {
  const { username, consumerId } = clients.get(msg.id);
  
  consumers.delete(consumerId);
  clients.delete(id);
  const videoObj = document.querySelector(`#remote_${username.value}`);
  videoObj.srcObject.getTracks().forEach(track => track.stop());
  videoObj.remove();

  // recalculateLayout();
}

const init = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${window.location.hostname}:${WS_PORT}`;

  connection = new WebSocket(url);
  
  connection.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if(msg.type === 'welcome') {
      localUUID = msg.id;
    }
    else if(msg.type === 'answer') {
      handleAnswer(msg);
    }
    else if(msg.type === 'peers') {
      handlePeers(msg);
    }
    else if(msg.type === 'consume') {
      handleConsume(msg);
    }
    else if(msg.type === 'new_producer') {
      handleNewProducer(msg);
    }
    else if(msg.type === 'user_left') {
      removeUser(msg);
    }
  }
  
  connection.onclose = (event) => {
    connection = null;
    localStream.getTracks().forEach(track => track.stop());
    clients = null;
    consumers = null;
  }

  connection.onopen = (event) => {
    connectBtn.disabled = false;
  }

}


connectBtn.addEventListener('click', async () => {
  localStream = await navigator.mediaDevices.getUserMedia(mediaConstraint);
  
  handleRemoteTrack(localStream, username.value);

  peer = new RTCPeerConnection(iceConfig);
  peer.onicecandidate = async (event) => {
    const candidate = event.candidate;
    if(candidate && candidate.candidate && candidate.candidate.length > 0) {
      const payload = {
        type: 'ice',
        ice: candidate,
        id: localUUID
      }
      await connection.send(JSON.stringify(payload));
    }
  }

  peer.onnegotiationneeded = async (event) => {
    const offer = await peer.createOffer;
    await peer.setLocalDescription(offer);

    const payload = {
      type: 'connect',
      sdp: peer.localDescription,
      id: localUUID,
      username: username.value
    }

    await connection.send(JSON.stringify(payload));
  }

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  const payload = {
    type: 'get_peers',
    id: localUUID
  }

  await connection.send(JSON.stringify(payload));

})
