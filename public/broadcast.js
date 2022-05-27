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
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  
  document.getElementById("video").srcObject = stream;
  
  const peerConnection = new RTCPeerConnection(iceConfig);
  
  peerConnection.onnegotiationneeded = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    const payload = {
      sdp: peerConnection.localDescription
    }
    
    const { data } = await axios.post('/broadcast', payload);
    
    const desc = new RTCSessionDescription(data.sdp);
    await peerConnection.setRemoteDescription(desc);
  }
  
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

}
window.onload = () => document.getElementById("stream").onclick = () => init();