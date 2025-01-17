class PeerService {
    constructor() {
      this.peer = null;
      this.createPeer();
    }
  
    createPeer() {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });
      return this.peer;
    }
  
    async getAnswer(offer) {
      try {
        if (!this.peer) {
          this.createPeer();
        }
        await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await this.peer.createAnswer();
        await this.peer.setLocalDescription(new RTCSessionDescription(ans));
        return ans;
      } catch (err) {
        console.error("Error creating answer:", err);
        throw err;
      }
    }
  
    async setLocalDescription(ans) {
      try {
        if (!this.peer) {
          this.createPeer();
        }
        await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
      } catch (err) {
        console.error("Error setting remote description:", err);
        throw err;
      }
    }
  
    async getOffer() {
      try {
        if (!this.peer) {
          this.createPeer();
        }
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(new RTCSessionDescription(offer));
        return offer;
      } catch (err) {
        console.error("Error creating offer:", err);
        throw err;
      }
    }
  
    addTrack(track, stream) {
      try {
        if (!this.peer) {
          this.createPeer();
        }
        this.peer.addTrack(track, stream);
      } catch (err) {
        console.error("Error adding track:", err);
        throw err;
      }
    }
  }
  
  export default new PeerService();