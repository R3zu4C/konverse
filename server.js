import express from 'express';
import fs from 'fs';
import webrtc from 'wrtc';
import bodyParser from 'body-parser';

const app = express();

let senderStream;

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/broadcast', (req, res) => {
  res.end(fs.readFileSync('./views/broadcast.html'));
})

app.get('/viewer', (req, res) => {
  res.end(fs.readFileSync('./views/viewer.html'));
})

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

app.post('/broadcast', async (req, res) => {
  const sdp = req.body.sdp;
  const peerConnection = new webrtc.RTCPeerConnection(iceConfig);

  
  peerConnection.ontrack = (event) => {
    senderStream = event.streams[0];
  }

  const desc = new webrtc.RTCSessionDescription(sdp);
  await peerConnection.setRemoteDescription(desc);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  res.json({ sdp: peerConnection.localDescription });

})

app.post('/viewer', async (req, res) => {
  const sdp = req.body.sdp;
  const peerConnection = new webrtc.RTCPeerConnection(iceConfig);

  const desc = new webrtc.RTCSessionDescription(sdp);
  await peerConnection.setRemoteDescription(desc);

  senderStream.getTracks().forEach((track) => peerConnection.addTrack(track, senderStream));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  res.json({ sdp: peerConnection.localDescription });

})

app.listen(5000, () => console.log("Server running on port 5000..."));
