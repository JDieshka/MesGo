/**
 * WebRTC Manager - Complete rewrite for proper screen share support
 */

export interface WebRTCConfig {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteStreamRemoved: (peerId: string) => void;
  onIceCandidate: (candidate: RTCIceCandidate, peerId: string) => void;
  onNegotiationNeeded: (offer: RTCSessionDescriptionInit, peerId: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState, peerId: string) => void;
  onScreenTrack: (stream: MediaStream | null, peerId: string) => void;
  onStreamsChange?: () => void;
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
  remoteScreenStream: MediaStream | null;
}

export class WebRTCManager {
  private peers: Map<string, PeerState> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private isInitiator: boolean = false;
  private originalVideoTrack: MediaStreamTrack | null = null;

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

      // Save original video track for later restoration
      this.originalVideoTrack = this.localStream.getVideoTracks()[0] || null;

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
      remoteScreenStream: null,
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

    // Remote stream - handle both camera and screen tracks
    connection.ontrack = (event) => {
      const track = event.track;
      console.log('[WebRTC] ontrack:', track.kind, 'label:', track.label, 'id:', track.id);

      // Determine if this is a screen share track
      // Screen share tracks typically have specific labels
      const isScreen = track.kind === 'video' && (
        track.label?.includes('screen') ||
        track.label?.includes('display') ||
        track.label?.includes('window') ||
        track.label?.includes('tab')
      );

      if (isScreen) {
        console.log('[WebRTC] Screen track received from:', peerId);
        // Create a separate stream for screen share
        let screenStream = peerState.remoteScreenStream;
        if (!screenStream) {
          screenStream = new MediaStream();
          peerState.remoteScreenStream = screenStream;
        }
        screenStream.addTrack(track);
        this.config.onScreenTrack(screenStream, peerId);
      } else {
        // Regular camera/audio track
        let remoteStream = peerState.remoteStream;
        if (!remoteStream) {
          remoteStream = new MediaStream();
          peerState.remoteStream = remoteStream;
        }
        remoteStream.addTrack(track);
        console.log('[WebRTC] Remote stream updated with track:', track.kind);
        this.config.onRemoteStream(remoteStream);
      }

      // Notify about streams change
      if (this.config.onStreamsChange) {
        this.config.onStreamsChange();
      }

      // Handle track end
      track.onended = () => {
        console.log('[WebRTC] Track ended:', track.kind, track.label);
        if (isScreen && peerState.remoteScreenStream) {
          peerState.remoteScreenStream.removeTrack(track);
          this.config.onScreenTrack(null, peerId);
        } else if (peerState.remoteStream) {
          peerState.remoteStream.removeTrack(track);
        }
        if (this.config.onStreamsChange) {
          this.config.onStreamsChange();
        }
      };
    };

    // Connection state
    connection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', connection.connectionState, 'for peer:', peerId);
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

  /**
   * Start screen share - replaces camera track with screen track
   * and triggers renegotiation so remote peer receives the new track
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as any,
        audio: true,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      console.log('[WebRTC] Screen share started, track label:', screenTrack.label);

      // Replace video track in all peer connections
      for (const [peerId, peer] of this.peers) {
        const senders = peer.connection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
          console.log('[WebRTC] Replaced video track with screen for peer:', peerId);
          
          // CRITICAL: Trigger renegotiation so remote peer receives the new track
          try {
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            console.log('[WebRTC] Sending renegotiation offer for screen share to:', peerId);
            this.config.onNegotiationNeeded(offer, peerId);
          } catch (err) {
            console.error('[WebRTC] Renegotiation failed for peer:', peerId, err);
          }
        } else {
          console.warn('[WebRTC] No video sender found for peer:', peerId);
        }
      }

      // Handle screen share stop (user clicks "Stop sharing")
      screenTrack.onended = () => {
        console.log('[WebRTC] Screen share track ended by user');
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (err) {
      console.error('[WebRTC] Screen share failed:', err);
      throw err;
    }
  }

  /**
   * Stop screen share - restores camera track
   */
  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Restore original camera track
    for (const [peerId, peer] of this.peers) {
      const senders = peer.connection.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');

      if (videoSender && this.originalVideoTrack) {
        try {
          await videoSender.replaceTrack(this.originalVideoTrack);
          console.log('[WebRTC] Restored camera track for peer:', peerId);
          
          // Renegotiate to restore camera on remote side
          const offer = await peer.connection.createOffer();
          await peer.connection.setLocalDescription(offer);
          this.config.onNegotiationNeeded(offer, peerId);
        } catch (err) {
          console.error('[WebRTC] Failed to restore camera for peer:', peerId, err);
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

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      this.config.onRemoteStreamRemoved(peerId);
    }
  }

  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
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

  getRemoteStream(): MediaStream | null {
    for (const peer of this.peers.values()) {
      if (peer.remoteStream) {
        return peer.remoteStream;
      }
    }
    return null;
  }

  getRemoteScreenStream(): MediaStream | null {
    for (const peer of this.peers.values()) {
      if (peer.remoteScreenStream) {
        return peer.remoteScreenStream;
      }
    }
    return null;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }
}
