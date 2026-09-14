/**
 * Authentication Service
 * Handles user registration, login, and token management
 */

// Auto-detect API base URL from current page location
// Works on localhost, local network (192.168.x.x), or any domain
// Automatically uses https:// for HTTPS and http:// for HTTP
const API_BASE_URL = window.location.origin;
console.log('[Auth] API base URL:', API_BASE_URL);

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  status: string;
  lastSeen: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
  displayName?: string;
  avatar?: string;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load token from localStorage on init
    this.token = localStorage.getItem('gotalk_token');
    const userStr = localStorage.getItem('gotalk_user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from localStorage');
      }
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    this.setAuth(data.token, data.user);
    return data;
  }

  async register(username: string, password: string, displayName?: string, avatar?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, displayName, avatar }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Registration failed');
    }

    const data: AuthResponse = await response.json();
    this.setAuth(data.token, data.user);
    return data;
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return null;
      }

      const user: User = await response.json();
      this.user = user;
      localStorage.setItem('gotalk_user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  setAuth(token: string, user: User): void {
    this.token = token;
    this.user = user;
    localStorage.setItem('gotalk_token', token);
    localStorage.setItem('gotalk_user', JSON.stringify(user));
  }

  logout(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('gotalk_token');
    localStorage.removeItem('gotalk_user');
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  getAuthHeader(): string {
    return `Bearer ${this.token}`;
  }
}

// Singleton instance
export const authService = new AuthService();
