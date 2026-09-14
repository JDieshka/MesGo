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
}

type CallStateHandler = (state: CallState) => void;

export class CallManager {
  private ws: WebSocketClient;
  private webrtc: WebRTCManager | null = null;
  private state: CallState;
  private stateHandler: CallStateHandler;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;

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
    };
  }

  async initiateCall(
    chatId: string,
    chatName: string,
    chatAvatar: string,
    targetUserId: string,
    type: CallType
  ): Promise<void> {
    this.state = {
      ...this.state,
      status: 'connecting',
      type,
      chatId,
      chatName,
      chatAvatar,
      participants: [],
      isIncoming: false,
    };
    this.stateHandler(this.state);

    // Initialize WebRTC
    this.webrtc = new WebRTCManager({
      onLocalStream: () => {},
      onRemoteStream: () => {},
      onRemoteStreamRemoved: () => {},
      onIceCandidate: (candidate, peerId) => {
        this.ws.send('signaling', {
          type: 'ice-candidate',
          to: peerId,
          chatId,
          data: candidate,
        });
      },
      onNegotiationNeeded: (offer, peerId) => {
        this.ws.send('signaling', {
          type: 'offer',
          to: peerId,
          chatId,
          data: offer,
        });
      },
      onConnectionStateChange: (connState, peerId) => {
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.startDurationTimer();
          this.stateHandler(this.state);
        } else if (connState === 'disconnected' || connState === 'failed') {
          this.endCall();
        }
      },
      onScreenTrack: () => {},
    });

    try {
      await this.webrtc.initializeLocalMedia(type === 'video');
    } catch (err) {
      console.error('[CallManager] Failed to get media:', err);
      this.endCall();
      return;
    }

    // Send call request via signaling
    this.ws.send('signaling', {
      type: 'call-request',
      to: targetUserId,
      chatId,
      callType: type,
    });

    // Create peer connection
    await this.webrtc.createPeerConnection(targetUserId, true);
    const offer = await this.webrtc.createOffer(targetUserId);

    this.ws.send('signaling', {
      type: 'offer',
      to: targetUserId,
      chatId,
      data: offer,
    });
  }

  async acceptCall(): Promise<void> {
    if (!this.state.chatId) return;

    this.state.status = 'connecting';
    this.stateHandler(this.state);

    // Initialize WebRTC
    this.webrtc = new WebRTCManager({
      onLocalStream: () => {},
      onRemoteStream: () => {},
      onRemoteStreamRemoved: () => {},
      onIceCandidate: (candidate, peerId) => {
        this.ws.send('signaling', {
          type: 'ice-candidate',
          to: peerId,
          chatId: this.state.chatId,
          data: candidate,
        });
      },
      onNegotiationNeeded: (offer, peerId) => {
        this.ws.send('signaling', {
          type: 'offer',
          to: peerId,
          chatId: this.state.chatId,
          data: offer,
        });
      },
      onConnectionStateChange: (connState) => {
        if (connState === 'connected') {
          this.state.status = 'connected';
          this.startDurationTimer();
          this.stateHandler(this.state);
        } else if (connState === 'disconnected' || connState === 'failed') {
          this.endCall();
        }
      },
      onScreenTrack: () => {},
    });

    try {
      await this.webrtc.initializeLocalMedia(this.state.type === 'video');
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

    switch (type) {
      case 'call-request':
        // Incoming call
        this.state = {
          ...this.state,
          status: 'ringing',
          type: callType || 'voice',
          chatId,
          isIncoming: true,
          callerName: from,
        };
        this.stateHandler(this.state);
        break;

      case 'call-accept':
        this.state.status = 'connecting';
        this.stateHandler(this.state);
        break;

      case 'call-reject':
      case 'call-end':
        this.endCall();
        break;

      case 'offer':
        if (this.webrtc && from) {
          await this.webrtc.createPeerConnection(from, false);
          const answer = await this.webrtc.handleOffer(from, data);
          this.ws.send('signaling', {
            type: 'answer',
            to: from,
            chatId,
            data: answer,
          });
        }
        break;

      case 'answer':
        if (this.webrtc && from) {
          await this.webrtc.handleAnswer(from, data);
        }
        break;

      case 'ice-candidate':
        if (this.webrtc && from) {
          await this.webrtc.handleIceCandidate(from, data);
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
    this.stateHandler(this.state);
  }
}
