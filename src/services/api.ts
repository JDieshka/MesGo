import { authService } from './auth';

const API_BASE_URL = window.location.origin;

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: string;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name: string;
  avatar: string;
  createdBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: string;
  voiceDuration?: number;
  audioData?: string;
  waveform?: number[];
  createdAt: string;
}

export interface ChatWithDetails {
  chat: Chat;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken();
    
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Users
  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
  }

  async getAllUsers(): Promise<User[]> {
    return this.request<User[]>('/api/users');
  }

  // Chats
  async getUserChatsWithDetails(): Promise<ChatWithDetails[]> {
    return this.request<ChatWithDetails[]>('/api/chats/details');
  }

  async createPrivateChat(participantId: string): Promise<{ chat: Chat; participants: User[] }> {
    return this.request('/api/chats', {
      method: 'POST',
      body: JSON.stringify({
        type: 'private',
        participantIds: [participantId],
      }),
    });
  }

  async createGroupChat(name: string, participantIds: string[], avatar?: string): Promise<{ chat: Chat; participants: User[] }> {
    return this.request('/api/chats', {
      method: 'POST',
      body: JSON.stringify({
        type: 'group',
        name,
        avatar: avatar || '💬',
        participantIds,
      }),
    });
  }

  async markChatAsRead(chatId: string): Promise<void> {
    await this.request(`/api/chats/${chatId}/read`, {
      method: 'PUT',
    });
  }

  // Messages
  async getChatMessages(chatId: string, limit = 50, offset = 0): Promise<Message[]> {
    return this.request<Message[]>(`/api/messages/${chatId}?limit=${limit}&offset=${offset}`);
  }
}

export const apiService = new ApiService();
