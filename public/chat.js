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

const init = async () => {  
  const peerConnection = new RTCPeerConnection(iceConfig);

  peerConnection.ontrack = (event) => document.getElementById("video").srcObject = event.streams[0];
  
  peerConnection.onnegotiationneeded = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    const payload = {
      id: Math.floor(Math.random() * 10000),
      sdp: peerConnection.localDescription
    }
    
    const { data } = await axios.post('/viewer', payload);
    
    const desc = new RTCSessionDescription(data.sdp);
    await peerConnection.setRemoteDescription(desc);
  }

  peerConnection.addTransceiver("video", { direction: "recvonly" });
}

window.onload = () => document.getElementById("stream").onclick = () => init();

