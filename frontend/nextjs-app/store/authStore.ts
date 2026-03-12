import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, AuthResponse } from '@/services/auth-service';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => {
        if (token) {
          authService.setToken(token);
        } else {
          authService.removeToken();
        }
        set({ token, isAuthenticated: !!token });
      },

      login: async (email: string, password: string) => {
        try {
          const response: AuthResponse = await authService.login({
            email,
            password,
          });
          authService.setToken(response.access_token);
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          throw error;
        }
      },

      signup: async (data: any) => {
        try {
          const response: AuthResponse = await authService.signup(data);
          authService.setToken(response.access_token);
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          authService.removeToken();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkAuth: async () => {
        const token = authService.getToken();
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const user = await authService.getProfile();
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          authService.removeToken();
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
