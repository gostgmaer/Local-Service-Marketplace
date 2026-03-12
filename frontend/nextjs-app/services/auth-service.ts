import { apiClient } from './api-client';

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'provider';
  phone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

class AuthService {
  async signup(data: SignupData): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/signup', data);
  }

  async login(data: LoginData): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', data);
  }

  async logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout');
  }

  async getProfile(): Promise<AuthResponse['user']> {
    return apiClient.get<AuthResponse['user']>('/auth/profile');
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    return apiClient.post<void>('/auth/password-reset/request', data);
  }

  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    return apiClient.post<void>('/auth/password-reset/confirm', data);
  }

  async verifyEmail(token: string): Promise<void> {
    return apiClient.post<void>('/auth/verify-email', { token });
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }
}

export const authService = new AuthService();
