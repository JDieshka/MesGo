import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef, useCallback } from 'react';
import { User, Chat, Message, CallState, VoiceRecording, WSConnectionStatus } from '../types';
import { WebSocketClient, getWebSocketClient, destroyWebSocketClient } from '../services/websocket';
import { AudioRecorder } from '../services/audioRecorder';
import { authService } from '../services/auth';
import { apiService } from '../services/api';

// State
interface AppState {
  currentUser: User;
  users: User[];
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeChatId: string | null;
  call: CallState;
  voiceRecording: VoiceRecording;
  sidebarOpen: boolean;
  wsStatus: WSConnectionStatus;
}

// Get authenticated user
const authUser = authService.getUser();
const currentUser: User = authUser
  ? {
      id: authUser.id,
      name: authUser.displayName,
      avatar: authUser.avatar,
      status: 'online',
    }
  : { id: '', name: '', avatar: '👤', status: 'offline' };

const initialState: AppState = {
  currentUser,
  users: [],
  chats: [],
  messages: {},
  activeChatId: null,
  call: {
    isActive: false,
    type: 'voice',
    chatId: null,
    participants: [],
    isScreenSharing: false,
    isMuted: false,
    isCameraOff: false,
    duration: 0,
    isIncoming: false,
    callerName: '',
    callerAvatar: '',
  },
  voiceRecording: {
    isRecording: false,
    duration: 0,
    waveform: [],
  },
  sidebarOpen: true,
  wsStatus: { status: 'disconnected' },
};

// Actions
type Action =
  | { type: 'SET_ACTIVE_CHAT'; payload: string | null }
  | { type: 'SET_CHATS'; payload: Chat[] }
  | { type: 'ADD_CHAT'; payload: Chat }
  | { type: 'SET_MESSAGES'; payload: { chatId: string; messages: Message[] } }
  | { type: 'SEND_MESSAGE'; payload: { chatId: string; message: Message } }
  | { type: 'RECEIVE_MESSAGE'; payload: { chatId: string; message: Message } }
  | { type: 'START_CALL'; payload: { chatId: string; type: 'voice' | 'video'; isIncoming?: boolean; callerName?: string; callerAvatar?: string } }
  | { type: 'UPDATE_CALL'; payload: Partial<CallState> }
  | { type: 'END_CALL' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'TOGGLE_SCREEN_SHARE' }
  | { type: 'START_RECORDING' }
  | { type: 'UPDATE_RECORDING'; payload: { duration: number; waveform: number[] } }
  | { type: 'STOP_RECORDING' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'SET_WS_STATUS'; payload: WSConnectionStatus }
  | { type: 'UPDATE_USER_STATUS'; payload: { userId: string; status: 'online' | 'offline' | 'busy' | 'away' } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_CHAT':
      return { ...state, activeChatId: action.payload };

    case 'SET_CHATS':
      return { ...state, chats: action.payload };

    case 'ADD_CHAT': {
      // Check if chat already exists
      const exists = state.chats.some(c => c.id === action.payload.id);
      if (exists) {
        // Update existing chat
        return {
          ...state,
          chats: state.chats.map(c => c.id === action.payload.id ? action.payload : c),
        };
      }
      // Add new chat at the beginning
      return { ...state, chats: [action.payload, ...state.chats] };
    }

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
      };

    case 'SEND_MESSAGE': {
      const chatMessages = state.messages[action.payload.chatId] || [];
      // Update chat's last message and move it to top
      const updatedChats = state.chats.map(c => {
        if (c.id === action.payload.chatId) {
          return { ...c, lastMessage: action.payload.message };
        }
        return c;
      });
      // Move updated chat to top
      const chatIndex = updatedChats.findIndex(c => c.id === action.payload.chatId);
      if (chatIndex > 0) {
        const [chat] = updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(chat);
      }
      return {
        ...state,
        chats: updatedChats,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [...chatMessages, action.payload.message],
        },
      };
    }

    case 'RECEIVE_MESSAGE': {
      const chatMessages = state.messages[action.payload.chatId] || [];
      
      // Check if message already exists (avoid duplicates)
      const messageExists = chatMessages.some(m => m.id === action.payload.message.id);
      if (messageExists) {
        return state;
      }

      const updatedChats = state.chats.map(c => {
        if (c.id === action.payload.chatId) {
          const updates: Partial<Chat> = { lastMessage: action.payload.message };
          // Only increment unread if this is not the active chat
          if (c.id !== state.activeChatId) {
            updates.unreadCount = c.unreadCount + 1;
          }
          return { ...c, ...updates };
        }
        return c;
      });

      // Move chat with new message to top
      const chatIndex = updatedChats.findIndex(c => c.id === action.payload.chatId);
      if (chatIndex > 0) {
        const [chat] = updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(chat);
      }

      return {
        ...state,
        chats: updatedChats,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [...chatMessages, action.payload.message],
        },
      };
    }

    case 'START_CALL':
      return {
        ...state,
        call: {
          isActive: true,
          type: action.payload.type,
          chatId: action.payload.chatId,
          participants: [],
          isScreenSharing: false,
          isMuted: false,
          isCameraOff: false,
          duration: 0,
          isIncoming: action.payload.isIncoming || false,
          callerName: action.payload.callerName || '',
          callerAvatar: action.payload.callerAvatar || '',
        },
      };

    case 'UPDATE_CALL':
      return { ...state, call: { ...state.call, ...action.payload } };

    case 'END_CALL':
      return {
        ...state,
        call: { ...initialState.call },
      };

    case 'TOGGLE_MUTE':
      return { ...state, call: { ...state.call, isMuted: !state.call.isMuted } };

    case 'TOGGLE_CAMERA':
      return { ...state, call: { ...state.call, isCameraOff: !state.call.isCameraOff } };

    case 'TOGGLE_SCREEN_SHARE':
      return { ...state, call: { ...state.call, isScreenSharing: !state.call.isScreenSharing } };

    case 'START_RECORDING':
      return { ...state, voiceRecording: { isRecording: true, duration: 0, waveform: [] } };

    case 'UPDATE_RECORDING':
      return {
        ...state,
        voiceRecording: {
          ...state.voiceRecording,
          duration: action.payload.duration,
          waveform: action.payload.waveform,
        },
      };

    case 'STOP_RECORDING':
      return { ...state, voiceRecording: { isRecording: false, duration: 0, waveform: [] } };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'MARK_AS_READ': {
      const updatedChats = state.chats.map(c =>
        c.id === action.payload ? { ...c, unreadCount: 0 } : c
      );
      return { ...state, chats: updatedChats };
    }

    case 'SET_WS_STATUS':
      return { ...state, wsStatus: action.payload };

    case 'UPDATE_USER_STATUS': {
      const updatedChats = state.chats.map(c => {
        const participant = c.participants.find(p => p.id === action.payload.userId);
        if (participant) {
          return { ...c, isOnline: action.payload.status === 'online' };
        }
        return c;
      });
      return { ...state, chats: updatedChats };
    }

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  wsClient: WebSocketClient | null;
  audioRecorder: AudioRecorder;
  sendMessage: (chatId: string, text: string) => void;
  sendVoiceMessage: (chatId: string, audioData: string, duration: number, waveform: number[]) => void;
  refreshChats: () => Promise<void>;
  refreshMessages: (chatId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const audioRecorderRef = useRef(new AudioRecorder());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Refresh chats from server
  const refreshChats = useCallback(async () => {
    try {
      const chatsWithDetails = await apiService.getUserChatsWithDetails();
      
      const chats: Chat[] = chatsWithDetails.map(chatDetail => {
        const otherParticipant = chatDetail.participants.find(p => p.id !== stateRef.current.currentUser.id);
        const chatName = chatDetail.chat.type === 'private' && otherParticipant
          ? otherParticipant.displayName
          : chatDetail.chat.name || 'Чат';
        
        return {
          id: chatDetail.chat.id,
          type: chatDetail.chat.type,
          name: chatName,
          avatar: chatDetail.chat.type === 'private' && otherParticipant
            ? otherParticipant.avatar
            : chatDetail.chat.avatar || '💬',
          participants: chatDetail.participants.map(p => ({
            id: p.id,
            name: p.displayName,
            avatar: p.avatar,
            status: p.status as any,
          })),
          unreadCount: chatDetail.unreadCount,
          isOnline: otherParticipant?.status === 'online',
        };
      });

      dispatch({ type: 'SET_CHATS', payload: chats });

      // Set first chat as active if no active chat
      if (chats.length > 0 && !stateRef.current.activeChatId) {
        dispatch({ type: 'SET_ACTIVE_CHAT', payload: chats[0].id });
      }
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  }, []);

  // Refresh messages for a specific chat
  const refreshMessages = useCallback(async (chatId: string) => {
    try {
      const messages = await apiService.getChatMessages(chatId);
      
      const appMessages: Message[] = messages.map(msg => ({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        text: msg.text,
        timestamp: new Date(msg.createdAt),
        type: msg.type as any,
        voiceDuration: msg.voiceDuration,
        audioData: msg.audioData,
        waveform: msg.waveform,
        isRead: true,
      }));

      dispatch({ type: 'SET_MESSAGES', payload: { chatId, messages: appMessages } });
      await apiService.markChatAsRead(chatId);
      dispatch({ type: 'MARK_AS_READ', payload: chatId });
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!state.currentUser.id) return;

    const ws = getWebSocketClient(state.currentUser.id);
    wsClientRef.current = ws;

    // Listen for connection status
    ws.onStatus((status) => {
      dispatch({ type: 'SET_WS_STATUS', payload: { status } });

      // When connected, refresh chats
      if (status === 'connected') {
        refreshChats();
      }
    });

    // Listen for incoming messages
    ws.on('chat-message', (payload: any) => {
      const message: Message = {
        id: payload.message.id || `m${Date.now()}`,
        chatId: payload.chatId,
        senderId: payload.message.senderId,
        text: payload.message.text,
        timestamp: new Date(payload.message.timestamp || Date.now()),
        type: payload.message.type || 'text',
        voiceDuration: payload.message.voiceDuration,
        audioData: payload.message.audioData,
        waveform: payload.message.waveform,
        isRead: false,
      };
      dispatch({ type: 'RECEIVE_MESSAGE', payload: { chatId: payload.chatId, message } });
    });

    // Listen for new chat created
    ws.on('new-chat', (payload: any) => {
      // Refresh chats when a new chat is created
      refreshChats();
    });

    // Listen for typing indicators
    ws.on('typing', (payload: any) => {
      console.log('[WS] User typing:', payload.userId, 'in chat:', payload.chatId);
    });

    // Listen for user status updates
    ws.on('user-status', (payload: any) => {
      dispatch({
        type: 'UPDATE_USER_STATUS',
        payload: { userId: payload.userId, status: payload.status },
      });
    });

    // Connect
    ws.connect();

    // Initial load of chats
    refreshChats();

    return () => {
      destroyWebSocketClient();
    };
  }, [state.currentUser.id, refreshChats]);

  // Load messages for active chat
  useEffect(() => {
    if (!state.activeChatId) return;
    refreshMessages(state.activeChatId);
  }, [state.activeChatId, refreshMessages]);

  // Send text message
  const sendMessage = (chatId: string, text: string) => {
    const message: Message = {
      id: `m${Date.now()}`,
      chatId,
      senderId: state.currentUser.id,
      text,
      timestamp: new Date(),
      type: 'text',
      isRead: false,
    };

    // Send via WebSocket
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.send('chat-message', {
        chatId,
        message: {
          text,
          type: 'text',
        },
      });
    }

    // Update local state
    dispatch({ type: 'SEND_MESSAGE', payload: { chatId, message } });
  };

  // Send voice message
  const sendVoiceMessage = (chatId: string, audioData: string, duration: number, waveform: number[]) => {
    const message: Message = {
      id: `m${Date.now()}`,
      chatId,
      senderId: state.currentUser.id,
      text: '🎤 Голосовое сообщение',
      timestamp: new Date(),
      type: 'voice',
      voiceDuration: duration,
      audioData,
      waveform,
      isRead: false,
    };

    // Send via WebSocket
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.send('chat-message', {
        chatId,
        message: {
          text: '🎤 Голосовое сообщение',
          type: 'voice',
          voiceDuration: duration,
          audioData,
          waveform,
        },
      });
    }

    // Update local state
    dispatch({ type: 'SEND_MESSAGE', payload: { chatId, message } });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        wsClient: wsClientRef.current,
        audioRecorder: audioRecorderRef.current,
        sendMessage,
        sendVoiceMessage,
        refreshChats,
        refreshMessages,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
