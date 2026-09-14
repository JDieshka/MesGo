/**
 * Call Manager
 * Orchestrates voice/video calls by connecting WebSocket signaling with WebRTC
 */

import { WebSocketClient } from './websocket';
import { WebRTCManager } from './webrtc';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

export interface CallState {
  status: CallStatus;
  type: CallType;
  chatId: string;
  chatName: string;
  chatAvatar: string;
  participants: { id: string; name: string; avatar: string }[];
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  duration: number;
  isIncoming: boolean;
  callerName: string;
  callerAvatar: string;
}

type CallStateHandler = (state: CallState) => void;

export class CallManager {
  private ws: WebSocketClient;
  private webrtc: WebRTCManager | null = null;
  private state: CallState;
  private stateHandler: CallStateHandler;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;
  private callerId: string = ''; // ID of the caller for incoming calls

  constructor(ws: WebSocketClient, stateHandler: CallStateHandler) {
    this.ws = ws;
    this.stateHandler = stateHandler;
    this.state = this.getInitialState();

    // Listen for signaling messages
    this.ws.on('signaling', (payload) => this.handleSignaling(payload));
  }

  private getInitialState(): CallState {
    return {
      status: 'idle',
      type: 'voice',
      chatId: '',
      chatName: '',
      chatAvatar: '',
      participants: [],
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      duration: 0,
      isIncoming: false,
      callerName: '',
      callerAvatar: '',
    };
  }

  async initiateCall(
    chatId: string,
    chatName: string,
    chatAvatar: string,
    targetUserId: string,
    type: CallType,
    callerAvatar: string = ''
  ): Promise<void> {
    console.log('[CallManager] Initiating call to:', targetUserId, 'type:', type);

    this.state = {
      ...this.state,
      status: 'ringing', // Start with ringing, not connecting
      type,
      chatId,
      chatName,
      chatAvatar,
      participants: [],
      isIncoming: false,
      callerName: chatName,
      callerAvatar: callerAvatar,
    };
    this.stateHandler(this.state);

    // Initialize WebRTC
    this.webrtc = new WebRTCManager({
      onLocalStream: (stream) => {
        console.log('[CallManager] Local stream acquired');
        // Trigger state update
        this.stateHandler(this.state);
      },
      onRemoteStream: (stream) => {
        console.log('[CallManager] Remote stream received');
        // Trigger state update
        this.stateHandler(this.state);
      },
      onRemoteStreamRemoved: (peerId) => {
        console.log('[CallManager] Remote stream removed:', peerId);
        this.stateHandler(this.state);
      },
      onIceCandidate: (candidate, peerId) => {
        console.log('[CallManager] Sending ICE candidate to:', peerId);
        this.ws.send('signaling', {
          type: 'ice-candidate',
          to: peerId,
          chatId,
          data: candidate,
        });
      },
      onNegotiationNeeded: async (offer, peerId) => {
        console.log('[CallManager] Negotiation needed, sending offer to:', peerId);
        this.ws.send('signaling', {
          type: 'offer',
          to: peerId,
          chatId,
          data: offer,
        });
      },
      onConnectionStateChange: (connState, peerId) => {
        console.log('[CallManager] Connection state changed:', connState, 'for peer:', peerId);
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.startDurationTimer();
          this.stateHandler(this.state);
        } else if (connState === 'disconnected' || connState === 'failed') {
          console.log('[CallManager] Connection failed, ending call');
          this.endCall();
        }
      },
      onScreenTrack: (stream, peerId) => {
        console.log('[CallManager] Screen track received from:', peerId);
        this.stateHandler(this.state);
      },
      onStreamsChange: () => {
        console.log('[CallManager] Streams changed, updating UI');
        this.stateHandler(this.state);
      },
    });

    try {
      await this.webrtc.initializeLocalMedia(type === 'video');
      console.log('[CallManager] Local media initialized');
    } catch (err) {
      console.error('[CallManager] Failed to get media:', err);
      this.endCall();
      return;
    }

    // Send call request via signaling (DON'T send offer yet - wait for accept)
    console.log('[CallManager] Sending call-request to:', targetUserId);
    this.ws.send('signaling', {
      type: 'call-request',
      to: targetUserId,
      chatId,
      callType: type,
      callerName: this.state.callerName,
      callerAvatar: this.state.callerAvatar,
    });

    // Save target user ID for later use
    this.callerId = targetUserId;

    // Wait for call-accept in handleSignaling, then create peer connection and send offer
    console.log('[CallManager] Waiting for call-accept...');
  }

  async acceptCall(): Promise<void> {
    if (!this.state.chatId) return;

    console.log('[CallManager] Accepting call for chat:', this.state.chatId);

    // Update state immediately - no longer incoming
    this.state = {
      ...this.state,
      status: 'connecting',
      isIncoming: false, // CRITICAL: Mark as no longer incoming
    };
    this.stateHandler(this.state);

    // Initialize WebRTC
    this.webrtc = new WebRTCManager({
      onLocalStream: (stream) => {
        console.log('[CallManager] Local stream acquired');
        // Trigger state update
        this.stateHandler(this.state);
      },
      onRemoteStream: (stream) => {
        console.log('[CallManager] Remote stream received');
        // Trigger state update
        this.stateHandler(this.state);
      },
      onRemoteStreamRemoved: (peerId) => {
        console.log('[CallManager] Remote stream removed:', peerId);
        this.stateHandler(this.state);
      },
      onIceCandidate: (candidate, peerId) => {
        console.log('[CallManager] Sending ICE candidate to:', peerId);
        this.ws.send('signaling', {
          type: 'ice-candidate',
          to: peerId,
          chatId: this.state.chatId,
          data: candidate,
        });
      },
      onNegotiationNeeded: async (offer, peerId) => {
        console.log('[CallManager] Negotiation needed, sending answer to:', peerId);
        this.ws.send('signaling', {
          type: 'answer',
          to: peerId,
          chatId: this.state.chatId,
          data: offer,
        });
      },
      onConnectionStateChange: (connState, peerId) => {
        console.log('[CallManager] Connection state changed:', connState, 'for peer:', peerId);
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.startDurationTimer();
          this.stateHandler(this.state);
        } else if (connState === 'disconnected' || connState === 'failed') {
          console.log('[CallManager] Connection failed, ending call');
          this.endCall();
        }
      },
      onScreenTrack: (stream, peerId) => {
        console.log('[CallManager] Screen track received from:', peerId);
        this.stateHandler(this.state);
      },
      onStreamsChange: () => {
        console.log('[CallManager] Streams changed, updating UI');
        this.stateHandler(this.state);
      },
    });

    try {
      await this.webrtc.initializeLocalMedia(this.state.type === 'video');
      console.log('[CallManager] Local media initialized');
    } catch (err) {
      console.error('[CallManager] Failed to get media:', err);
      this.endCall();
      return;
    }

    // Send accept
    this.ws.send('signaling', {
      type: 'call-accept',
      chatId: this.state.chatId,
    });

    console.log('[CallManager] Call accepted, waiting for offer from caller');
  }

  rejectCall(): void {
    this.ws.send('signaling', {
      type: 'call-reject',
      chatId: this.state.chatId,
    });
    this.resetState();
  }

  endCall(): void {
    if (this.state.chatId) {
      this.ws.send('signaling', {
        type: 'call-end',
        chatId: this.state.chatId,
      });
    }

    this.webrtc?.cleanup();
    this.webrtc = null;
    this.stopDurationTimer();
    this.resetState();
  }

  toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
    this.webrtc?.toggleMute(this.state.isMuted);
    this.stateHandler(this.state);
  }

  toggleCamera(): void {
    this.state.isCameraOff = !this.state.isCameraOff;
    this.webrtc?.toggleCamera(!this.state.isCameraOff);
    this.stateHandler(this.state);
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.webrtc) return;

    if (this.state.isScreenSharing) {
      await this.webrtc.stopScreenShare();
      this.state.isScreenSharing = false;
    } else {
      try {
        await this.webrtc.startScreenShare();
        this.state.isScreenSharing = true;
      } catch (err) {
        console.error('[CallManager] Screen share failed:', err);
        return;
      }
    }
    this.stateHandler(this.state);
  }

  getState(): CallState {
    return { ...this.state };
  }

  getWebRTC(): WebRTCManager | null {
    return this.webrtc;
  }

  private async handleSignaling(payload: any): Promise<void> {
    const { type, from, chatId, callType, data } = payload;

    console.log('[CallManager] Received signaling:', type, 'from:', from);

    switch (type) {
      case 'call-request':
        // Incoming call - save caller ID
        console.log('[CallManager] Incoming call from:', from);
        this.callerId = from;
        this.state = {
          ...this.state,
          status: 'ringing',
          type: callType || 'voice',
          chatId,
          isIncoming: true,
          callerName: payload.callerName || from,
          callerAvatar: payload.callerAvatar || '👤',
        };
        this.stateHandler(this.state);
        break;

      case 'call-accept':
        console.log('[CallManager] Call accepted by callee');
        this.state.status = 'connecting';
        this.stateHandler(this.state);
        
        // If we're the caller (not incoming), create peer connection and send offer
        if (!this.state.isIncoming && this.webrtc && this.callerId) {
          console.log('[CallManager] Creating peer connection and sending offer to:', this.callerId);
          try {
            await this.webrtc.createPeerConnection(this.callerId, true);
            const offer = await this.webrtc.createOffer(this.callerId);
            console.log('[CallManager] Sending offer to:', this.callerId);
            this.ws.send('signaling', {
              type: 'offer',
              to: this.callerId,
              chatId: this.state.chatId,
              data: offer,
            });
          } catch (err) {
            console.error('[CallManager] Failed to create offer:', err);
            this.endCall();
          }
        }
        break;

      case 'call-reject':
      case 'call-end':
        console.log('[CallManager] Call rejected or ended');
        this.endCall();
        break;

      case 'offer':
        console.log('[CallManager] Received offer from:', from);
        if (!this.webrtc) {
          console.error('[CallManager] WebRTC not initialized when receiving offer');
          return;
        }
        if (!from) {
          console.error('[CallManager] No sender ID in offer');
          return;
        }
        
        try {
          // Create peer connection if it doesn't exist
          const existingPeer = this.webrtc.getPeerConnection(from);
          if (!existingPeer) {
            console.log('[CallManager] Creating peer connection for:', from);
            await this.webrtc.createPeerConnection(from, false);
          }
          
          const answer = await this.webrtc.handleOffer(from, data);
          console.log('[CallManager] Sending answer to:', from);
          this.ws.send('signaling', {
            type: 'answer',
            to: from,
            chatId,
            data: answer,
          });
        } catch (err) {
          console.error('[CallManager] Failed to handle offer:', err);
          this.endCall();
        }
        break;

      case 'answer':
        console.log('[CallManager] Received answer from:', from);
        if (this.webrtc && from) {
          try {
            await this.webrtc.handleAnswer(from, data);
            console.log('[CallManager] Answer processed successfully');
          } catch (err) {
            console.error('[CallManager] Failed to handle answer:', err);
          }
        }
        break;

      case 'ice-candidate':
        console.log('[CallManager] Received ICE candidate from:', from);
        if (this.webrtc && from) {
          try {
            await this.webrtc.handleIceCandidate(from, data);
          } catch (err) {
            console.error('[CallManager] Failed to handle ICE candidate:', err);
          }
        }
        break;
    }
  }

  private startDurationTimer(): void {
    this.startTime = Date.now();
    this.durationInterval = setInterval(() => {
      this.state.duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.stateHandler(this.state);
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private resetState(): void {
    this.state = this.getInitialState();
    this.callerId = '';
    this.stateHandler(this.state);
  }
}
