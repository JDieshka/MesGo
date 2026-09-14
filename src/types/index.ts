export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen?: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'voice' | 'system';
  voiceDuration?: number; // seconds
  isRead: boolean;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name: string;
  avatar: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isOnline?: boolean;
}

export interface CallState {
  isActive: boolean;
  type: 'voice' | 'video';
  chatId: string | null;
  participants: User[];
  isScreenSharing: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  duration: number;
}

export interface VoiceRecording {
  isRecording: boolean;
  duration: number;
}
