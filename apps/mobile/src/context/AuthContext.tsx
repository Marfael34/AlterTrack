import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import {
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserProfile,
} from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      const storedToken = await StorageService.getAuthToken();
      const storedUser = await StorageService.getAuthUser();

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          setUser(storedUser);
        }
        try {
          const freshUser = await ApiService.getProfile();
          setUser(freshUser);
          await StorageService.setAuthUser(freshUser);
        } catch (err: any) {
          // Si le token est invalide ou expiré (401), déconnecter proprement
          if (err?.message?.includes('401') || err?.message?.toLowerCase().includes('unauthorized')) {
            await StorageService.removeAuthToken();
            await StorageService.removeAuthUser();
            setToken(null);
            setUser(null);
          }
        }
      }
    } catch (e) {
      console.warn('Erreur lors du chargement de la session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (payload: LoginPayload) => {
    const response = await ApiService.login(payload);
    await StorageService.setAuthToken(response.accessToken);
    await StorageService.setAuthUser(response.user);
    setToken(response.accessToken);
    setUser(response.user);
  };

  const register = async (payload: RegisterPayload) => {
    const response = await ApiService.register(payload);
    await StorageService.setAuthToken(response.accessToken);
    await StorageService.setAuthUser(response.user);
    setToken(response.accessToken);
    setUser(response.user);
  };

  const logout = async () => {
    await StorageService.removeAuthToken();
    await StorageService.removeAuthUser();
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (
    payload: UpdateProfilePayload,
  ): Promise<UserProfile> => {
    const updated = await ApiService.updateProfile(payload);
    setUser(updated);
    await StorageService.setAuthUser(updated);
    return updated;
  };

  const refreshProfile = async () => {
    try {
      const freshUser = await ApiService.getProfile();
      setUser(freshUser);
      await StorageService.setAuthUser(freshUser);
    } catch {
      // Ignorer si offline
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé au sein d\'un AuthProvider');
  }
  return context;
};
