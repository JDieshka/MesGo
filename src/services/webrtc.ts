/**
 * WebRTC Manager
 * Handles peer connections for voice/video calls and screen sharing
 */

export interface WebRTCConfig {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteStreamRemoved: (peerId: string) => void;
  onIceCandidate: (candidate: RTCIceCandidate, peerId: string) => void;
  onNegotiationNeeded: (offer: RTCSessionDescriptionInit, peerId: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState, peerId: string) => void;
  onScreenTrack: (stream: MediaStream | null, peerId: string) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

interface PeerState {
  connection: RTCPeerConnection;
  peerId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;
}

export class WebRTCManager {
  private peers: Map<string, PeerState> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private isInitiator: boolean = false;

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  async initializeLocalMedia(video: boolean = false): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video ? { width: 1280, height: 720 } : false,
      });

      this.config.onLocalStream(this.localStream);
      return this.localStream;
    } catch (err) {
      console.error('[WebRTC] Failed to get local media:', err);
      throw err;
    }
  }

  async createPeerConnection(peerId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    this.isInitiator = isInitiator;

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const peerState: PeerState = {
      connection,
      peerId,
      localStream: this.localStream,
      remoteStream: null,
      screenStream: null,
    };

    this.peers.set(peerId, peerState);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        connection.addTrack(track, this.localStream!);
      });
    }

    // ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onIceCandidate(event.candidate, peerId);
      }
    };

    // Remote stream
    connection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        // Check if it's a screen share track
        const track = event.track;
        if (track.kind === 'video' && track.label?.includes('screen')) {
          this.config.onScreenTrack(remoteStream, peerId);
        } else {
          peerState.remoteStream = remoteStream;
          this.config.onRemoteStream(remoteStream);
        }
      }
    };

    // Negotiation needed (for adding tracks later)
    connection.onnegotiationneeded = async () => {
      if (isInitiator) {
        try {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          this.config.onNegotiationNeeded(offer, peerId);
        } catch (err) {
          console.error('[WebRTC] Negotiation error:', err);
        }
      }
    };

    // Connection state
    connection.onconnectionstatechange = () => {
      this.config.onConnectionStateChange(connection.connectionState, peerId);
    };

    return connection;
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);

    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);

    await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as any,
        audio: true,
      });

      // Replace video track in all peer connections
      const screenTrack = this.screenStream.getVideoTracks()[0];

      for (const [peerId, peer] of this.peers) {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }

      // Handle screen share stop
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (err) {
      console.error('[WebRTC] Screen share failed:', err);
      throw err;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Restore camera track (or remove video if camera was off)
    for (const [peerId, peer] of this.peers) {
      const cameraTrack = this.localStream?.getVideoTracks()[0];
      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');

      if (sender) {
        if (cameraTrack) {
          await sender.replaceTrack(cameraTrack);
        } else {
          sender.track?.stop();
          await sender.replaceTrack(null as any);
        }
      }
    }
  }

  toggleMute(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  toggleCamera(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  async addPeer(peerId: string): Promise<RTCPeerConnection> {
    return this.createPeerConnection(peerId, this.isInitiator);
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      this.config.onRemoteStreamRemoved(peerId);
    }
  }

  cleanup(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Close all peer connections
    for (const [peerId, peer] of this.peers) {
      peer.connection.close();
    }
    this.peers.clear();
  }

  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peers.get(peerId)?.connection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}
