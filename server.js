import express from 'express';
import webrtc from 'wrtc';
import WebSocket from 'ws';
import { uuidv4 } from 'uuid';

const WebSocketServer = WebSocket.Server;

const app = express();

app.use(express.static('public'));

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

const webServer = app.listen(5000, () => console.log('Server running on port 5000...'));

const peers = new Map();
const consumers = new Map();

const webSocketServer = new WebSocketServer({ server: webServer });

webSocketServer.broadcast = (message) => {
  peers.forEach((peer) => {
      if (peer.socket.readyState === WebSocket.OPEN) {
          peer.socket.send(message);
      }
  });
};

webSocketServer.on("connection", async (socket) => {
  const peerId = uuidv4();
  socket.id = peerId;

  socket.on('close', (e) => {
    peers.delete(socket.id);
    consumers.delete(socket.id);

    webSocketServer.broadcast(JSON.stringify({
      type: 'user_left',
      id: socket.id,
    }))
  })

  webSocketServer.send(JSON.stringify({
    type: 'welcome',
    id: socket.id,
  }))

  socket.on('message', async (message) => {
    const msg = JSON.parse(message);

    if(msg.type === 'connect') {
      const peer = new webrtc.RTCPeerConnection(iceConfig);

      peers.set(socket.id, { socket: socket });
      peers.get(socket.id).username = msg.username;
      peers.get(socket.id).peer = peer;

      peer.ontrack((event) => {
        if(event.streams[0]) {
          peers.get(socket.id).stream = event.streams[0];

          const payload = {
            type: 'new_producer',
            id: socket.id,
            username: peers.get(socket.id).username,
          }

          webSocketServer.broadcast(JSON.stringify(payload));
        }
      })

      const desc = webrtc.RTCSessionDescription(msg.sdp);
      await peer.setRemoteDescription(desc);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      const payload = {
        type: 'answer',
        sdp: peer.localDescription,
      }

      socket.send(JSON.stringify(payload));

    } 
    else if(msg.type === 'get_peers') {
      const peerList = [];
      peers.forEach((peer, key) => {
        peerList.push({
          id: key,
          username: peer.username,
        })
      })

      const payload = {
        type: 'peers',
        peers: list,
      }

      socket.send(JSON.stringify(payload));

    } 
    else if(msg.type === 'consume') {
      const remoteUser = peers.get(msg.producerId);
      
      const peer = new webrtc.RTCPeerConnection(iceConfig);
      consumers.set(msg.consumerId, peer);

      remoteUser.stream.getTracks().forEach((track) => peer.addTrack((track, remoteUser.stream)))

      const desc = webrtc.RTCSessionDescription(msg.sdp);
      await peer.setRemoteDescription(desc);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      const payload = {
        type: 'consume',
        sdp: peer.localDescription,
        consumerId: msg.consumerId,
        producerId: msg.producerId,
        username: remoteUser.username,
      }

      socket.send(JSON.stringify(payload));

    } 
    else if(msg.type === 'ice') {
      const user = peers.get(msg.id);

      if(user.peer) {
        const iceCandidate = new webrtc.RTCIceCandidate(msg.ice);
        await user.peer.addIceCandidate(iceCandidate);
      }

    } 
    else if(msg.type === 'cosumer_ice') {
      const user = consumers.get(msg.id);

      if(user.peer) {
        const iceCandidate = new webrtc.RTCIceCandidate(msg.ice);
        await user.peer.addIceCandidate(iceCandidate);
      }

    }
    else webSocketServer.broadcast(msg);
  })

  socket.on('error', (error) => socket.terminate());
})


