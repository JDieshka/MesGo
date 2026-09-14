import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef } from 'react';
import { User, Chat, Message, CallState, VoiceRecording, WSConnectionStatus } from '../types';
import { WebSocketClient, getWebSocketClient, destroyWebSocketClient } from '../services/websocket';
import { AudioRecorder, blobToBase64 } from '../services/audioRecorder';

// Mock users
const mockUsers: User[] = [
  { id: '1', name: 'Вы', avatar: '👤', status: 'online' },
  { id: '2', name: 'Алексей Петров', avatar: '👨‍💻', status: 'online' },
  { id: '3', name: 'Мария Иванова', avatar: '👩‍🎨', status: 'online' },
  { id: '4', name: 'Дмитрий Козлов', avatar: '🧑‍🔬', status: 'offline' },
  { id: '5', name: 'Елена Смирнова', avatar: '👩‍💼', status: 'away' },
  { id: '6', name: 'Сергей Волков', avatar: '👨‍🚀', status: 'online' },
  { id: '7', name: 'Анна Новикова', avatar: '👩‍🏫', status: 'busy' },
];

const mockChats: Chat[] = [
  {
    id: 'chat1',
    type: 'private',
    name: 'Алексей Петров',
    avatar: '👨‍💻',
    participants: [mockUsers[0], mockUsers[1]],
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: 'chat2',
    type: 'private',
    name: 'Мария Иванова',
    avatar: '👩‍🎨',
    participants: [mockUsers[0], mockUsers[2]],
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: 'chat3',
    type: 'group',
    name: 'Команда разработки',
    avatar: '💻',
    participants: [mockUsers[0], mockUsers[1], mockUsers[2], mockUsers[3]],
    unreadCount: 5,
  },
  {
    id: 'chat4',
    type: 'private',
    name: 'Дмитрий Козлов',
    avatar: '🧑‍🔬',
    participants: [mockUsers[0], mockUsers[3]],
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: 'chat5',
    type: 'group',
    name: 'Дизайн-команда',
    avatar: '🎨',
    participants: [mockUsers[0], mockUsers[2], mockUsers[4], mockUsers[6]],
    unreadCount: 1,
  },
  {
    id: 'chat6',
    type: 'private',
    name: 'Елена Смирнова',
    avatar: '👩‍💼',
    participants: [mockUsers[0], mockUsers[4]],
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: 'chat7',
    type: 'private',
    name: 'Сергей Волков',
    avatar: '👨‍🚀',
    participants: [mockUsers[0], mockUsers[5]],
    unreadCount: 3,
    isOnline: true,
  },
];

const mockMessages: Record<string, Message[]> = {
  chat1: [
    { id: 'm1', chatId: 'chat1', senderId: '2', text: 'Привет! Как дела с проектом?', timestamp: new Date(Date.now() - 3600000), type: 'text', isRead: true },
    { id: 'm2', chatId: 'chat1', senderId: '1', text: 'Привет! Всё идёт по плану, заканчиваю бэкенд на Go', timestamp: new Date(Date.now() - 3500000), type: 'text', isRead: true },
    { id: 'm3', chatId: 'chat1', senderId: '2', text: 'Отлично! WebSocket уже готов?', timestamp: new Date(Date.now() - 3400000), type: 'text', isRead: true },
    { id: 'm4', chatId: 'chat1', senderId: '1', text: 'Да, уже подключил signaling server для WebRTC', timestamp: new Date(Date.now() - 3300000), type: 'text', isRead: true },
    { id: 'm5', chatId: 'chat1', senderId: '2', text: 'Супер! Давай созвонимся вечером обсудим детали?', timestamp: new Date(Date.now() - 1800000), type: 'text', isRead: false },
    { id: 'm6', chatId: 'chat1', senderId: '2', text: '🎤 Голосовое сообщение', timestamp: new Date(Date.now() - 900000), type: 'voice', voiceDuration: 15, isRead: false },
  ],
  chat2: [
    { id: 'm7', chatId: 'chat2', senderId: '3', text: 'Посмотри новые макеты, я обновила дизайн', timestamp: new Date(Date.now() - 7200000), type: 'text', isRead: true },
    { id: 'm8', chatId: 'chat2', senderId: '1', text: 'Выглядит потрясающе! Мне нравится новый стиль', timestamp: new Date(Date.now() - 7100000), type: 'text', isRead: true },
    { id: 'm9', chatId: 'chat2', senderId: '3', text: 'Спасибо! 🎉', timestamp: new Date(Date.now() - 7000000), type: 'text', isRead: true },
  ],
  chat3: [
    { id: 'm10', chatId: 'chat3', senderId: '2', text: 'Всем привет! Стендап через 10 минут', timestamp: new Date(Date.now() - 5400000), type: 'text', isRead: true },
    { id: 'm11', chatId: 'chat3', senderId: '3', text: 'Ок, буду!', timestamp: new Date(Date.now() - 5300000), type: 'text', isRead: true },
    { id: 'm12', chatId: 'chat3', senderId: '4', text: 'Я немного опоздаю, начните без меня', timestamp: new Date(Date.now() - 5200000), type: 'text', isRead: true },
    { id: 'm13', chatId: 'chat3', senderId: '1', text: 'Хорошо, подождём 5 минут', timestamp: new Date(Date.now() - 5100000), type: 'text', isRead: true },
    { id: 'm14', chatId: 'chat3', senderId: '2', text: 'Ребят, кто может провести код-ревью PR #142?', timestamp: new Date(Date.now() - 3600000), type: 'text', isRead: false },
  ],
  chat4: [
    { id: 'm15', chatId: 'chat4', senderId: '1', text: 'Дим, можешь глянуть логи на проде?', timestamp: new Date(Date.now() - 86400000), type: 'text', isRead: true },
    { id: 'm16', chatId: 'chat4', senderId: '4', text: 'Сейчас посмотрю', timestamp: new Date(Date.now() - 86300000), type: 'text', isRead: true },
  ],
  chat5: [
    { id: 'm17', chatId: 'chat5', senderId: '6', text: 'Новая палитра готова, смотрите в Figma', timestamp: new Date(Date.now() - 10800000), type: 'text', isRead: false },
  ],
  chat6: [
    { id: 'm18', chatId: 'chat6', senderId: '5', text: 'Встреча перенесена на завтра в 14:00', timestamp: new Date(Date.now() - 43200000), type: 'text', isRead: true },
  ],
  chat7: [
    { id: 'm19', chatId: 'chat7', senderId: '6', text: 'Тестирование API завершено, всё работает!', timestamp: new Date(Date.now() - 600000), type: 'text', isRead: false },
    { id: 'm20', chatId: 'chat7', senderId: '6', text: '🎤 Голосовое', timestamp: new Date(Date.now() - 500000), type: 'voice', voiceDuration: 8, isRead: false },
    { id: 'm21', chatId: 'chat7', senderId: '6', text: 'Нужно ещё нагрузочное тестирование провести', timestamp: new Date(Date.now() - 400000), type: 'text', isRead: false },
  ],
};

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

const initialState: AppState = {
  currentUser: mockUsers[0],
  users: mockUsers,
  chats: mockChats,
  messages: mockMessages,
  activeChatId: 'chat1',
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
  | { type: 'SET_ACTIVE_CHAT'; payload: string }
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

    case 'SEND_MESSAGE': {
      const chatMessages = state.messages[action.payload.chatId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [...chatMessages, action.payload.message],
        },
      };
    }

    case 'RECEIVE_MESSAGE': {
      const chatMessages = state.messages[action.payload.chatId] || [];
      const updatedChats = state.chats.map(c => {
        if (c.id === action.payload.chatId && c.id !== state.activeChatId) {
          return { ...c, unreadCount: c.unreadCount + 1, lastMessage: action.payload.message };
        }
        if (c.id === action.payload.chatId) {
          return { ...c, lastMessage: action.payload.message };
        }
        return c;
      });
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
      const updatedUsers = state.users.map(u =>
        u.id === action.payload.userId ? { ...u, status: action.payload.status } : u
      );
      const updatedChats = state.chats.map(c => {
        const participant = c.participants.find(p => p.id === action.payload.userId);
        if (participant) {
          return { ...c, isOnline: action.payload.status === 'online' };
        }
        return c;
      });
      return { ...state, users: updatedUsers, chats: updatedChats };
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const audioRecorderRef = useRef(new AudioRecorder());

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = getWebSocketClient(state.currentUser.id);
    wsClientRef.current = ws;

    // Listen for connection status
    ws.onStatus((status) => {
      dispatch({ type: 'SET_WS_STATUS', payload: { status } });
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

    // Listen for typing indicators
    ws.on('typing', (payload: any) => {
      // Could show typing indicator in UI
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

    return () => {
      destroyWebSocketClient();
    };
  }, [state.currentUser.id]);

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
  const sendVoiceMessage = async (chatId: string, audioData: string, duration: number, waveform: number[]) => {
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
